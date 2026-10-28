-- Migration: Fix user and profile deletion cascading
-- Description:
-- 1. Updates foreign key on public.events(organizer_id) to ON DELETE CASCADE
--    so organizers and their created events can be deleted without FK violations.
-- 2. Adds trigger on public.profiles AFTER DELETE to automatically delete the
--    associated auth.users record if deleted from the Supabase Table Editor.
-- 3. Adds admin_delete_user() RPC function allowing administrators to delete users
--    directly from the CampusConnect admin dashboard.

-- 1. Update foreign key on public.events
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_organizer_id_fkey;
ALTER TABLE public.events 
  ADD CONSTRAINT events_organizer_id_fkey 
  FOREIGN KEY (organizer_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

-- 2. Create trigger to sync deletion from public.profiles to auth.users
CREATE OR REPLACE FUNCTION public.handle_profile_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Prevent infinite loop if delete originated from auth.users cascade
  IF pg_trigger_depth() <= 1 THEN
    DELETE FROM auth.users WHERE id = OLD.id;
  END IF;
  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_deleted ON public.profiles;
CREATE TRIGGER on_profile_deleted
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_deleted();

-- 3. Admin RPC to delete any user safely
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  calling_user_role TEXT;
BEGIN
  -- Verify calling user is an admin
  SELECT role INTO calling_user_role 
  FROM public.profiles 
  WHERE id = auth.uid();

  IF calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied. Only administrators can delete users.';
  END IF;

  -- Prevent admin from deleting themselves
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own administrator account.';
  END IF;

  -- Delete from auth.users (cascades to profiles, events, registrations, results, certificates, etc.)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Grant execution permission to authenticated users (role check is done inside the function)
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
