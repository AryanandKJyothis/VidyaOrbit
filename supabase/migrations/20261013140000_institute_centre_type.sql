-- Owner onboarding: centre kind collected in the setup wizard.
-- Additive and nullable only. Existing RLS on public.institutes covers the
-- new column (select for members, update for settings:write).
--
-- DO NOT apply this migration from CI or this PR. The founder applies it.
-- Previews share the production database; the app does not write centre_type
-- until this column exists.

ALTER TABLE public.institutes
  ADD COLUMN IF NOT EXISTS centre_type text;

COMMENT ON COLUMN public.institutes.centre_type IS
  'Owner-declared centre kind (tuition, PSC, CBSE, state syllabus, other). Nullable.';

-- Column-level grant, matching institutes.upi_vpa (admin_notes stays revoked).
GRANT SELECT, UPDATE (centre_type) ON public.institutes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.institutes TO authenticated;
