-- VO-046: revoke authenticated EXECUTE on unused SECURITY DEFINER helpers.
-- has_resource_access / member_permission / is_workspace_member stay granted
-- (they back RLS and students_gated).
-- Do NOT apply from this PR. File only until a founder tap.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'has_role',
        'current_user_is_admin',
        'get_user_emails',
        'get_my_institute_id',
        'is_institute_owner'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      r.sig
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      r.sig
    );
  END LOOP;
END $$;
