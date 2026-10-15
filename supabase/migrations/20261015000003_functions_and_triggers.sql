-- CampusConnect Migration 3: Business Logic, Triggers, and Atomic Stored Procedures

-- 1. TRIGGER: AUTOMATIC STUDENT PROFILE CREATION ON USER SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_full_name TEXT;
    user_avatar TEXT;
BEGIN
    -- Extract full name from Google metadata or fallback to email prefix
    user_full_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );

    user_avatar := COALESCE(
        new.raw_user_meta_data->>'avatar_url',
        new.raw_user_meta_data->>'picture',
        NULL
    );

    -- Strict security: ALWAYS assign 'student' role. Organizer/Admin granted through admin action only.
    INSERT INTO public.profiles (id, full_name, email, avatar_url, role)
    VALUES (
        new.id,
        user_full_name,
        new.email,
        user_avatar,
        'student'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. STORED PROCEDURE: ATOMIC EVENT REGISTRATION WITH CLASH DETECTION & CAPACITY LOCK
CREATE OR REPLACE FUNCTION public.register_for_event(
    p_event_id UUID,
    p_team_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
    v_conflicting_event RECORD;
    v_current_count INTEGER;
    v_registration_id UUID;
    v_team RECORD;
    v_team_count INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- Lock the event row for atomic capacity check
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found.';
    END IF;

    IF v_event.status != 'published' THEN
        RAISE EXCEPTION 'Event is not open for registration (status: %).', v_event.status;
    END IF;

    IF v_event.registration_deadline <= timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'Registration deadline has passed.';
    END IF;

    -- Check if student already registered for this event
    IF EXISTS (
        SELECT 1 FROM public.registrations
        WHERE event_id = p_event_id AND student_id = v_user_id AND status = 'confirmed'
    ) THEN
        RAISE EXCEPTION 'You are already registered for this event.';
    END IF;

    -- SERVER-SIDE ATOMIC EVENT CLASH DETECTION
    -- Conflict condition: new_start < existing_end AND new_end > existing_start
    SELECT e.title, e.start_at, e.end_at, e.venue INTO v_conflicting_event
    FROM public.registrations r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.student_id = v_user_id
      AND r.status = 'confirmed'
      AND e.status = 'published'
      AND e.id != p_event_id
      AND (v_event.start_at < e.end_at AND v_event.end_at > e.start_at)
    LIMIT 1;

    IF v_conflicting_event.title IS NOT NULL THEN
        RAISE EXCEPTION 'Time clash detected: "%" conflicts with this event schedule (% to %).',
            v_conflicting_event.title,
            v_conflicting_event.start_at,
            v_conflicting_event.end_at;
    END IF;

    -- Handle Team vs Individual validation
    IF v_event.registration_type = 'individual' AND p_team_id IS NOT NULL THEN
        RAISE EXCEPTION 'This event requires individual registration.';
    END IF;

    IF v_event.registration_type = 'team' THEN
        IF p_team_id IS NULL THEN
            RAISE EXCEPTION 'Team selection or team creation is required for this event.';
        END IF;

        -- Validate team existence and capacity
        SELECT * INTO v_team FROM public.teams WHERE id = p_team_id AND event_id = p_event_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Specified team was not found for this event.';
        END IF;

        SELECT COUNT(*) INTO v_team_count FROM public.registrations WHERE team_id = p_team_id AND status = 'confirmed';
        IF v_team_count >= v_event.team_max_size THEN
            RAISE EXCEPTION 'This team has already reached its maximum capacity of % members.', v_event.team_max_size;
        END IF;
    END IF;

    -- ATOMIC CAPACITY CHECK
    SELECT COUNT(*) INTO v_current_count
    FROM public.registrations
    WHERE event_id = p_event_id AND status = 'confirmed';

    IF v_current_count >= v_event.capacity THEN
        RAISE EXCEPTION 'This event has reached full capacity (% participants).', v_event.capacity;
    END IF;

    -- Insert confirmed registration
    INSERT INTO public.registrations (event_id, student_id, team_id, status)
    VALUES (p_event_id, v_user_id, p_team_id, 'confirmed')
    RETURNING id INTO v_registration_id;

    -- Record audit log
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_user_id,
        'REGISTER_EVENT',
        'event',
        p_event_id::text,
        jsonb_build_object(
            'registration_id', v_registration_id,
            'team_id', p_team_id,
            'event_title', v_event.title
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'registration_id', v_registration_id,
        'message', 'Registration confirmed successfully!'
    );
END;
$$;


-- 3. STORED PROCEDURE: CREATE TEAM AND AUTO-REGISTER LEADER
CREATE OR REPLACE FUNCTION public.create_team_with_leader(
    p_event_id UUID,
    p_team_name TEXT,
    p_invite_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
    v_team_id UUID;
    v_code_hash TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found.';
    END IF;

    IF v_event.registration_type != 'team' THEN
        RAISE EXCEPTION 'Event is not a team-based event.';
    END IF;

    -- Check if user is already leading a team or registered
    IF EXISTS (
        SELECT 1 FROM public.registrations
        WHERE event_id = p_event_id AND student_id = v_user_id AND status = 'confirmed'
    ) THEN
        RAISE EXCEPTION 'You are already registered for this event.';
    END IF;

    -- Hash the raw invite code for storage
    v_code_hash := encode(digest(p_invite_code, 'sha256'), 'hex');

    -- Create team
    INSERT INTO public.teams (event_id, team_name, leader_id, invite_code_hash, status)
    VALUES (p_event_id, p_team_name, v_user_id, v_code_hash, 'forming')
    RETURNING id INTO v_team_id;

    -- Automatically register the leader as the first member of this team
    PERFORM public.register_for_event(p_event_id, v_team_id);

    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_team_id,
        'team_name', p_team_name,
        'message', 'Team created and leader registered successfully.'
    );
END;
$$;


-- 4. STORED PROCEDURE: JOIN TEAM USING INVITATION CODE
CREATE OR REPLACE FUNCTION public.join_team_with_code(
    p_event_id UUID,
    p_invite_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_code_hash TEXT;
    v_team RECORD;
    v_res JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    v_code_hash := encode(digest(p_invite_code, 'sha256'), 'hex');

    SELECT * INTO v_team
    FROM public.teams
    WHERE event_id = p_event_id AND invite_code_hash = v_code_hash;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid team invitation code for this event.';
    END IF;

    -- Execute atomic registration with clash detection
    v_res := public.register_for_event(p_event_id, v_team.id);

    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_team.id,
        'team_name', v_team.team_name,
        'message', 'Joined team successfully!'
    );
END;
$$;


-- 5. STORED PROCEDURE: SECURE QR ATTENDANCE CHECK-IN
CREATE OR REPLACE FUNCTION public.check_in_with_qr(
    p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_token_hash TEXT;
    v_session RECORD;
    v_registration RECORD;
    v_event RECORD;
    v_student RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Please sign in to mark attendance.';
    END IF;

    -- Hash incoming token
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    -- Validate session: token hash must match, active, unrevoked, not expired
    SELECT * INTO v_session
    FROM public.event_qr_sessions
    WHERE token_hash = v_token_hash
      AND revoked_at IS NULL
      AND v_now BETWEEN valid_from AND expires_at;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid, expired, or revoked QR check-in session. Please ask the organizer to refresh the QR code.';
    END IF;

    -- Fetch event info
    SELECT * INTO v_event FROM public.events WHERE id = v_session.event_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found.';
    END IF;

    -- Verify student has a confirmed registration
    SELECT * INTO v_registration
    FROM public.registrations
    WHERE event_id = v_session.event_id 
      AND student_id = v_user_id 
      AND status = 'confirmed';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'You are not registered for this event ("%"). Only registered attendees can check in.', v_event.title;
    END IF;

    -- Check if student already checked in
    IF EXISTS (
        SELECT 1 FROM public.attendance
        WHERE event_id = v_session.event_id AND student_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Attendance already marked for "%". Duplicate check-in is not allowed.', v_event.title;
    END IF;

    -- Record attendance
    INSERT INTO public.attendance (event_id, student_id, registration_id, method)
    VALUES (v_session.event_id, v_user_id, v_registration.id, 'qr');

    -- Audit log
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_user_id,
        'QR_CHECK_IN',
        'event',
        v_session.event_id::text,
        jsonb_build_object('event_title', v_event.title, 'session_id', v_session.id)
    );

    RETURN jsonb_build_object(
        'success', true,
        'event_id', v_session.event_id,
        'event_title', v_event.title,
        'checked_in_at', v_now,
        'message', 'Attendance recorded successfully!'
    );
END;
$$;


-- 6. STORED PROCEDURE: MANUAL ATTENDANCE CHECK-IN (ORGANIZER / ADMIN ONLY)
CREATE OR REPLACE FUNCTION public.manual_record_attendance(
    p_event_id UUID,
    p_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
    v_registration RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found.';
    END IF;

    -- Verify organizer or admin authority
    IF NOT (public.is_admin() OR v_event.organizer_id = v_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: You are not the organizer of this event.';
    END IF;

    -- Verify registration
    SELECT * INTO v_registration
    FROM public.registrations
    WHERE event_id = p_event_id AND student_id = p_student_id AND status = 'confirmed';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student is not registered for this event.';
    END IF;

    -- Check if already present
    IF EXISTS (
        SELECT 1 FROM public.attendance
        WHERE event_id = p_event_id AND student_id = p_student_id
    ) THEN
        RAISE EXCEPTION 'Student is already marked present for this event.';
    END IF;

    -- Record attendance
    INSERT INTO public.attendance (event_id, student_id, registration_id, checked_in_by, method)
    VALUES (p_event_id, p_student_id, v_registration.id, v_user_id, 'manual');

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Student marked present successfully.'
    );
END;
$$;


-- 7. PUBLIC CERTIFICATE VERIFICATION FUNCTION
CREATE OR REPLACE FUNCTION public.verify_certificate_public(
    p_certificate_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cert RECORD;
    v_event RECORD;
    v_student RECORD;
BEGIN
    SELECT * INTO v_cert
    FROM public.certificates
    WHERE certificate_number = p_certificate_number;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'found', false,
            'message', 'Certificate not found. Please verify the certificate number.'
        );
    END IF;

    SELECT title, venue, start_at, end_at INTO v_event
    FROM public.events WHERE id = v_cert.event_id;

    SELECT full_name, email, department INTO v_student
    FROM public.profiles WHERE id = v_cert.student_id;

    RETURN jsonb_build_object(
        'found', true,
        'is_valid', (v_cert.revoked_at IS NULL),
        'revoked_at', v_cert.revoked_at,
        'certificate_number', v_cert.certificate_number,
        'certificate_type', v_cert.certificate_type,
        'issued_at', v_cert.issued_at,
        'student_name', v_student.full_name,
        'department', v_student.department,
        'event_title', v_event.title,
        'event_venue', v_event.venue,
        'event_date', v_event.start_at
    );
END;
$$;
