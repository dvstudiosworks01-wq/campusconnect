-- CampusConnect Migration 4: Seed Data & Initial Administrative Setup

-- 1. SEED DEFAULT EVENT CATEGORIES
INSERT INTO public.event_categories (id, name, description)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Technical & Hackathons', 'Coding sprints, robotics tournaments, web design hackathons, and hardware showcases'),
    ('22222222-2222-2222-2222-222222222222', 'Cultural & Arts', 'Music festivals, drama productions, dance showcases, fine arts, and literary events'),
    ('33333333-3333-3333-3333-333333333333', 'Sports & Athletics', 'Inter-department tournaments, track and field, badminton, cricket, and indoor games'),
    ('44444444-4444-4444-4444-444444444444', 'Workshops & Seminars', 'Industry expert talks, hands-on masterclasses, career bootcamps, and research seminars'),
    ('55555555-5555-5555-5555-555555555555', 'Competitions & Quizzes', 'Debates, business pitch competitions, general knowledge quizzes, and math olympiads'),
    ('66666666-6666-6666-6666-666666666666', 'Social & Community', 'Blood donation drives, campus clean-ups, sustainability campaigns, and outreach')
ON CONFLICT (name) DO NOTHING;

-- 2. SEED CONFIGURABLE LEADERBOARD POINT RULES
INSERT INTO public.leaderboard_point_rules (id, rank, points, description, is_active)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 10, 'First Place / Winner', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, 7, 'Second Place / Runner Up', true),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 3, 5, 'Third Place / Second Runner Up', true),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 0, 1, 'Event Attendance / Participation', true)
ON CONFLICT (rank) DO UPDATE SET 
    points = EXCLUDED.points,
    description = EXCLUDED.description;

-- 3. STORAGE BUCKETS SETUP (Private for certificates, public for event banners)
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('event-banners', 'event-banners', true),
    ('certificates', 'certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
-- Allow anyone to read event banners
CREATE POLICY "Public read for event banners"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'event-banners');

-- Allow authenticated organizers to upload event banners
CREATE POLICY "Organizers upload event banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-banners' AND public.is_organizer());

-- Certificates are private: only certificate owner, organizers, and admins can read
CREATE POLICY "Authorized access to certificates bucket"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'certificates' AND (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.certificates c
            WHERE c.storage_path = name AND (c.student_id = auth.uid() OR public.is_organizer())
        )
    )
);

CREATE POLICY "Organizers and Admins can upload certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'certificates' AND public.is_organizer());
