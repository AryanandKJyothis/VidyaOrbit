-- VO-021: capture live institutes.upi_vpa (11–12 Oct 2026) so migration
-- history matches prod. The column already exists on qyqomxuxtpbhnicbtmbq;
-- schema_migrations still ends at 20261008142028 (repo files 20261011120000
-- and 20261011121500 were never recorded).
--
-- This file is a no-op against that live state:
--   ADD COLUMN IF NOT EXISTS, GRANT (idempotent), policy created only if missing.
-- Do not apply from CI or this PR. No data rewrite. No function changes
-- (none exist for UPI).

ALTER TABLE public.institutes
  ADD COLUMN IF NOT EXISTS upi_vpa text;

COMMENT ON COLUMN public.institutes.upi_vpa IS
  'Centre UPI VPA. Parents pay this ID directly; VidyaOrbit does not receive the money.';

-- Live column ACLs (12 Oct export): authenticated SELECT/INSERT/UPDATE/REFERENCES;
-- anon REFERENCES only.
GRANT SELECT, INSERT, UPDATE, REFERENCES (upi_vpa) ON public.institutes TO authenticated;
GRANT REFERENCES (upi_vpa) ON public.institutes TO anon;

-- Live inst_update is settings:write (owner or staff). Recreate only if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'institutes'
      AND policyname = 'inst_update'
  ) THEN
    CREATE POLICY inst_update ON public.institutes
      FOR UPDATE TO authenticated
      USING (public.has_resource_access(owner_id, auth.uid(), 'settings', true))
      WITH CHECK (public.has_resource_access(owner_id, auth.uid(), 'settings', true));
  END IF;
END $$;
