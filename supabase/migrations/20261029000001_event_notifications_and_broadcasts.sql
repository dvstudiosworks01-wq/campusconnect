-- Migration: Event Notifications and Organizer Broadcasts
-- Created at: 2026-10-29

-- 1. Add read_at column to notifications if not exists
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 2. Function to broadcast notification to all students (Security Definer)
CREATE OR REPLACE FUNCTION public.notify_all_students(
    p_subject TEXT,
    p_body TEXT,
    p_event_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Verify sender authorization (must be organizer or admin)
    IF NOT (public.is_organizer() OR public.is_admin()) THEN
        RAISE EXCEPTION 'Access denied: Only organizers and administrators can broadcast notifications.';
    END IF;

    -- Bulk insert into notifications for all registered student profiles
    WITH inserted AS (
        INSERT INTO public.notifications (user_id, event_id, type, subject, body, status, sent_at, created_at)
        SELECT 
            p.id,
            p_event_id,
            CASE WHEN p_event_id IS NOT NULL THEN 'event_announcement' ELSE 'campus_broadcast' END,
            p_subject,
            p_body,
            'sent',
            now(),
            now()
        FROM public.profiles p
        WHERE p.role = 'student'
        RETURNING id
    )
    SELECT count(*) INTO v_count FROM inserted;

    RETURN v_count;
END;
$$;

-- 3. Function to notify registered students of a specific event
CREATE OR REPLACE FUNCTION public.notify_event_registrants(
    p_event_id UUID,
    p_subject TEXT,
    p_body TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_count INTEGER := 0;
    v_is_authorized BOOLEAN;
BEGIN
    -- Authorization check: caller must be event organizer or admin
    SELECT EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = p_event_id AND (e.organizer_id = auth.uid() OR public.is_admin())
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access denied: You are not authorized to broadcast to registrants of this event.';
    END IF;

    -- Bulk insert to distinct registered students
    WITH distinct_students AS (
        SELECT DISTINCT student_id 
        FROM public.registrations 
        WHERE event_id = p_event_id AND status != 'cancelled'
    ),
    inserted AS (
        INSERT INTO public.notifications (user_id, event_id, type, subject, body, status, sent_at, created_at)
        SELECT 
            ds.student_id,
            p_event_id,
            'event_update',
            p_subject,
            p_body,
            'sent',
            now(),
            now()
        FROM distinct_students ds
        RETURNING id
    )
    SELECT count(*) INTO v_count FROM inserted;

    RETURN v_count;
END;
$$;

-- 4. Automatic Trigger to notify all students when an event is published
CREATE OR REPLACE FUNCTION public.notify_students_on_event_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_venue TEXT;
BEGIN
    -- Check if status is transitioning to 'published'
    IF (TG_OP = 'INSERT' AND NEW.status = 'published') OR
       (TG_OP = 'UPDATE' AND NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published') THEN
        
        v_venue := COALESCE(NEW.venue, 'Kongu Engineering College Campus');

        INSERT INTO public.notifications (user_id, event_id, type, subject, body, status, sent_at, created_at)
        SELECT 
            p.id,
            NEW.id,
            'event_announcement',
            'New Event Announced: ' || NEW.title,
            'A new college event "' || NEW.title || '" has been published! Venue: ' || v_venue || '. Check out the event details and reserve your slot before registration closes.',
            'sent',
            now(),
            now()
        FROM public.profiles p
        WHERE p.role = 'student';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_students_on_event_published ON public.events;
CREATE TRIGGER trg_notify_students_on_event_published
    AFTER INSERT OR UPDATE OF status ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_students_on_event_published();

-- 5. Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.notify_all_students(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_event_registrants(UUID, TEXT, TEXT) TO authenticated;
