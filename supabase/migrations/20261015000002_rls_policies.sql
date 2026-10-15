-- CampusConnect Migration 2: Row Level Security (RLS) Policies
-- Enforce strict role-based access control across all tables

-- Helper function to fetch the authenticated user's role without recursive RLS trigger
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(user_role, 'student');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT (public.get_current_user_role() = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_organizer()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT (public.get_current_user_role() IN ('organizer', 'admin'));
$$;

-- ENABLE RLS ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_qr_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_point_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES POLICIES
-- Anyone authenticated can view user profiles (e.g. participant list, leaderboard names, organizers)
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile fields (except role)
CREATE POLICY "Users can update their own profile details"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id AND 
    (role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
);

-- Admin can update any profile (including role changes)
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 2. EVENT CATEGORIES POLICIES
-- All users (authenticated and anonymous) can view event categories
CREATE POLICY "Event categories are viewable by all"
ON public.event_categories FOR SELECT
TO anon, authenticated
USING (true);

-- Only admin can manage categories
CREATE POLICY "Admins can insert categories"
ON public.event_categories FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update categories"
ON public.event_categories FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete categories"
ON public.event_categories FOR DELETE
TO authenticated
USING (public.is_admin());

-- 3. EVENTS POLICIES
-- Anyone can view published or completed events
CREATE POLICY "Published and completed events are viewable by all"
ON public.events FOR SELECT
TO anon, authenticated
USING (status IN ('published', 'completed') OR organizer_id = auth.uid() OR public.is_admin());

-- Organizers and Admins can create events (draft or pending)
CREATE POLICY "Organizers and admins can create events"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (
    public.is_organizer() AND 
    auth.uid() = organizer_id
);

-- Organizers can update their own non-completed/non-cancelled events; Admins can update all
CREATE POLICY "Organizers can update their own events"
ON public.events FOR UPDATE
TO authenticated
USING (
    public.is_admin() OR 
    (organizer_id = auth.uid() AND status IN ('draft', 'pending', 'rejected'))
)
WITH CHECK (
    public.is_admin() OR 
    (organizer_id = auth.uid())
);

-- Admins can delete/cancel events
CREATE POLICY "Admins can delete events"
ON public.events FOR DELETE
TO authenticated
USING (public.is_admin());

-- 4. TEAMS POLICIES
-- Authenticated users can view teams for published events
CREATE POLICY "Teams are viewable by authenticated users"
ON public.teams FOR SELECT
TO authenticated
USING (true);

-- Students can create a team as leader for team-based published events
CREATE POLICY "Students can create teams"
ON public.teams FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = leader_id);

-- Leader or Admin can update team status
CREATE POLICY "Leader or Admin can update team"
ON public.teams FOR UPDATE
TO authenticated
USING (auth.uid() = leader_id OR public.is_admin())
WITH CHECK (auth.uid() = leader_id OR public.is_admin());

-- 5. REGISTRATIONS POLICIES
-- Students can view their own registrations; Organizers can view registrations for their events; Admins can view all
CREATE POLICY "Users can view relevant registrations"
ON public.registrations FOR SELECT
TO authenticated
USING (
    student_id = auth.uid() OR 
    public.is_admin() OR 
    EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = registrations.event_id AND e.organizer_id = auth.uid()
    )
);

-- Students can insert registrations (individual or team)
CREATE POLICY "Students can register for events"
ON public.registrations FOR INSERT
TO authenticated
WITH CHECK (
    student_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = registrations.event_id 
          AND e.status = 'published' 
          AND e.registration_deadline > now()
    )
);

-- Students can update/cancel their own registration; Admins/Organizers can update
CREATE POLICY "Registrations can be updated by owner or organizer"
ON public.registrations FOR UPDATE
TO authenticated
USING (
    student_id = auth.uid() OR 
    public.is_admin() OR 
    EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = registrations.event_id AND e.organizer_id = auth.uid()
    )
);

-- 6. ATTENDANCE POLICIES
-- Students can view their own attendance; Organizers can view attendance for their events; Admins can view all
CREATE POLICY "Users can view attendance"
ON public.attendance FOR SELECT
TO authenticated
USING (
    student_id = auth.uid() OR 
    public.is_admin() OR 
    EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = attendance.event_id AND e.organizer_id = auth.uid()
    )
);

-- Organizers and Admins can insert attendance records (Manual check-in). QR check-in runs through SECURITY DEFINER function.
CREATE POLICY "Organizers and Admins can record attendance"
ON public.attendance FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin() OR 
    EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = attendance.event_id AND e.organizer_id = auth.uid()
    )
);

-- 7. EVENT QR SESSIONS POLICIES
-- Organizers and Admins can view and manage QR sessions for their events
CREATE POLICY "Organizers and Admins can view QR sessions"
ON public.event_qr_sessions FOR SELECT
TO authenticated
USING (
    public.is_admin() OR 
    EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = event_qr_sessions.event_id AND e.organizer_id = auth.uid()
    )
);

CREATE POLICY "Organizers and Admins can create QR sessions"
ON public.event_qr_sessions FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin() OR 
    EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = event_qr_sessions.event_id AND e.organizer_id = auth.uid()
    )
);

CREATE POLICY "Organizers and Admins can revoke QR sessions"
ON public.event_qr_sessions FOR UPDATE
TO authenticated
USING (
    public.is_admin() OR 
    EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = event_qr_sessions.event_id AND e.organizer_id = auth.uid()
    )
);

-- 8. LEADERBOARD POINT RULES POLICIES
CREATE POLICY "Leaderboard rules are viewable by all"
ON public.leaderboard_point_rules FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can manage leaderboard rules"
ON public.leaderboard_point_rules FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 9. RESULTS POLICIES
CREATE POLICY "Results are viewable by all"
ON public.results FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Organizers and Admins can manage results"
ON public.results FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin() OR 
    EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = results.event_id AND e.organizer_id = auth.uid()
    )
);

CREATE POLICY "Organizers and Admins can update results"
ON public.results FOR UPDATE
TO authenticated
USING (
    public.is_admin() OR 
    EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = results.event_id AND e.organizer_id = auth.uid()
    )
);

-- 10. CERTIFICATES POLICIES
-- Students can view their own certificates; Organizers can view event certificates; Admins can view all;
-- Verification by certificate number is handled by a public security-definer function or select policy
CREATE POLICY "Users can view certificates"
ON public.certificates FOR SELECT
TO authenticated
USING (
    student_id = auth.uid() OR 
    public.is_admin() OR 
    EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = certificates.event_id AND e.organizer_id = auth.uid()
    )
);

CREATE POLICY "Public verification can select certificates"
ON public.certificates FOR SELECT
TO anon
USING (revoked_at IS NULL);

CREATE POLICY "Organizers and Admins can manage certificates"
ON public.certificates FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin() OR 
    EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = certificates.event_id AND e.organizer_id = auth.uid()
    )
);

CREATE POLICY "Admins can revoke certificates"
ON public.certificates FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 11. NOTIFICATIONS POLICIES
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications (e.g. mark read)"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins and Organizers can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (public.is_organizer());

-- 12. AUDIT LOGS POLICIES
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = actor_id OR actor_id IS NULL);
