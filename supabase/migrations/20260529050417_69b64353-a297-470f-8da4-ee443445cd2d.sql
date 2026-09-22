
-- 1. Remove unused support chat tables
DROP FUNCTION IF EXISTS public.support_handle_new_message() CASCADE;
DROP TABLE IF EXISTS public.support_messages CASCADE;
DROP TABLE IF EXISTS public.support_threads CASCADE;

-- Drop leftover storage policies for support-attachments bucket so no one can read/write it
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (policyname ILIKE '%support%' OR qual::text ILIKE '%support-attachments%' OR with_check::text ILIKE '%support-attachments%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- 2. Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.member_permission(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_permission(uuid, uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_resource_access(uuid, uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_resource_access(uuid, uuid, text, boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_plan(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.plan_student_limit(plan_code) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_student_limit(plan_code) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.workspace_seed_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_receipt_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_student_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
