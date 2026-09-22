-- 1. Drop unused support tables + trigger function
DROP TABLE IF EXISTS public.support_messages CASCADE;
DROP TABLE IF EXISTS public.support_threads CASCADE;
DROP FUNCTION IF EXISTS public.support_on_new_message() CASCADE;

-- 2. Lock down the orphaned support-attachments bucket with explicit deny policies.
--    (Bucket itself can only be removed via Storage API, but we block all client access.)
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname ILIKE '%support%attachment%' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "support-attachments deny select"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'support-attachments' AND false);
CREATE POLICY "support-attachments deny insert"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'support-attachments' AND false);
CREATE POLICY "support-attachments deny update"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'support-attachments' AND false)
  WITH CHECK (bucket_id = 'support-attachments' AND false);
CREATE POLICY "support-attachments deny delete"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'support-attachments' AND false);

-- 3. Lock down user_roles: explicitly deny client INSERT/UPDATE/DELETE.
DROP POLICY IF EXISTS "no client insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "no client update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "no client delete user_roles" ON public.user_roles;

CREATE POLICY "no client insert user_roles"
  ON public.user_roles FOR INSERT TO anon, authenticated
  WITH CHECK (false);
CREATE POLICY "no client update user_roles"
  ON public.user_roles FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "no client delete user_roles"
  ON public.user_roles FOR DELETE TO anon, authenticated
  USING (false);