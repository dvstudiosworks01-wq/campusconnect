-- Migration: Add Faculty/Staff support to profiles and onboarding
-- Description:
-- 1. Adds metadata columns (roll_number, designation, phone) to public.profiles.
-- 2. Stored procedure for student onboarding.
-- 3. Stored procedure for faculty/staff onboarding with automatic 'organizer' role assignment.

-- 1. Add optional columns to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS roll_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Stored procedure for atomic student onboarding
CREATE OR REPLACE FUNCTION public.complete_student_onboarding(
  p_full_name TEXT,
  p_department TEXT,
  p_year_of_study INTEGER,
  p_roll_number TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET full_name = COALESCE(NULLIF(p_full_name, ''), full_name),
      department = p_department,
      year_of_study = p_year_of_study,
      roll_number = UPPER(p_roll_number),
      phone = p_phone,
      role = 'student',
      updated_at = timezone('utc'::text, now())
  WHERE id = v_user_id;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'user_type', 'student',
    'roll_number', UPPER(p_roll_number),
    'phone', p_phone,
    'department', p_department,
    'year_of_study', p_year_of_study
  )
  WHERE id = v_user_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_student_onboarding(TEXT, TEXT, INTEGER, TEXT, TEXT) TO authenticated;

-- 3. Stored procedure for atomic faculty/staff onboarding
CREATE OR REPLACE FUNCTION public.complete_faculty_onboarding(
  p_full_name TEXT,
  p_department TEXT,
  p_staff_id TEXT,
  p_designation TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET full_name = COALESCE(NULLIF(p_full_name, ''), full_name),
      department = p_department,
      year_of_study = NULL, -- Faculty/Staff do not have year of study
      roll_number = UPPER(p_staff_id), -- Store Staff ID
      designation = p_designation,
      phone = p_phone,
      role = 'organizer', -- Grant organizer capabilities to faculty/staff
      updated_at = timezone('utc'::text, now())
  WHERE id = v_user_id;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'user_type', 'faculty',
    'staff_id', UPPER(p_staff_id),
    'designation', p_designation,
    'phone', p_phone,
    'department', p_department
  )
  WHERE id = v_user_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_faculty_onboarding(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
