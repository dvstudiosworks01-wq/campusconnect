-- Target: Supabase PostgreSQL
-- Note: Supabase pre-installs pgcrypto and uuid-ossp in the extensions schema


-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    department TEXT,
    year_of_study INTEGER CHECK (year_of_study BETWEEN 1 AND 5),
    role TEXT NOT NULL CHECK (role IN ('student', 'organizer', 'admin')) DEFAULT 'student',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. EVENT CATEGORIES
CREATE TABLE IF NOT EXISTS public.event_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES public.event_categories(id) ON DELETE RESTRICT,
    venue TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    registration_deadline TIMESTAMPTZ NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    registration_type TEXT NOT NULL CHECK (registration_type IN ('individual', 'team')) DEFAULT 'individual',
    team_min_size INTEGER NOT NULL DEFAULT 1 CHECK (team_min_size >= 1),
    team_max_size INTEGER NOT NULL DEFAULT 1 CHECK (team_max_size >= team_min_size),
    status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'published', 'rejected', 'cancelled', 'completed')) DEFAULT 'draft',
    banner_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_event_times CHECK (start_at < end_at),
    CONSTRAINT chk_registration_deadline CHECK (registration_deadline <= start_at)
);

-- 4. TEAMS TABLE
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    leader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invite_code_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('forming', 'completed', 'disbanded')) DEFAULT 'forming',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_team_event_name UNIQUE (event_id, team_name),
    CONSTRAINT uq_team_event_leader UNIQUE (event_id, leader_id)
);

-- 5. REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled', 'waitlist')) DEFAULT 'confirmed',
    registered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_student_event_registration UNIQUE (event_id, student_id)
);

-- 6. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    checked_in_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    method TEXT NOT NULL CHECK (method IN ('qr', 'manual')) DEFAULT 'qr',
    CONSTRAINT uq_student_event_attendance UNIQUE (event_id, student_id)
);

-- 7. EVENT QR SESSIONS
CREATE TABLE IF NOT EXISTS public.event_qr_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. LEADERBOARD POINT RULES
CREATE TABLE IF NOT EXISTS public.leaderboard_point_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rank INTEGER NOT NULL UNIQUE, -- 1=1st, 2=2nd, 3=3rd, 0=Participation
    points INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. RESULTS TABLE
CREATE TABLE IF NOT EXISTS public.results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL CHECK (rank >= 1),
    score NUMERIC(6, 2),
    points_awarded INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_result_target CHECK (
        (student_id IS NOT NULL AND team_id IS NULL) OR 
        (student_id IS NULL AND team_id IS NOT NULL)
    ),
    CONSTRAINT uq_event_rank UNIQUE (event_id, rank)
);

-- 10. CERTIFICATES TABLE
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    certificate_number TEXT NOT NULL UNIQUE,
    certificate_type TEXT NOT NULL CHECK (certificate_type IN ('participation', 'winner', 'runner_up', 'merit', 'organizer')),
    storage_path TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    revoked_at TIMESTAMPTZ,
    CONSTRAINT uq_event_student_cert_type UNIQUE (event_id, student_id, certificate_type)
);

-- 11. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- INDEXES FOR PERFORMANCE & FILTERING
CREATE INDEX IF NOT EXISTS idx_events_status_start ON public.events (status, start_at);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events (category_id);
CREATE INDEX IF NOT EXISTS idx_events_organizer ON public.events (organizer_id);
CREATE INDEX IF NOT EXISTS idx_registrations_event ON public.registrations (event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_student ON public.registrations (student_id);
CREATE INDEX IF NOT EXISTS idx_registrations_team ON public.registrations (team_id);
CREATE INDEX IF NOT EXISTS idx_teams_event ON public.teams (event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_event ON public.attendance (event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_student ON public.certificates (student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON public.certificates (certificate_number);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON public.notifications (user_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
