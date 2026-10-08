-- Gate student fee amounts from non-fees members
-- Problem: students table exposes fee_total, fee_due_date to anyone with students:read
-- Solution: Create security_invoker view that nulls fee columns for non-fees members
-- Owners and fees:read+ members see all columns; others see NULL for fee fields

CREATE OR REPLACE VIEW public.students_gated
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.owner_id,
  s.full_name,
  s.phone,
  s.guardian_name,
  s.guardian_phone,
  s.batch_id,
  s.joining_date,
  s.status,
  s.address,
  s.notes,
  s.created_at,
  s.updated_at,
  -- Gate fee columns: show real values only when user has fees permission
  CASE
    WHEN s.owner_id = auth.uid() THEN s.fee_total
    WHEN EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_owner_id = s.owner_id
        AND wm.member_user_id = auth.uid()
        AND wm.permissions->>'fees' IN ('read', 'write')
    ) THEN s.fee_total
    ELSE NULL
  END AS fee_total,
  CASE
    WHEN s.owner_id = auth.uid() THEN s.fee_due_date
    WHEN EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_owner_id = s.owner_id
        AND wm.member_user_id = auth.uid()
        AND wm.permissions->>'fees' IN ('read', 'write')
    ) THEN s.fee_due_date
    ELSE NULL
  END AS fee_due_date
FROM public.students s;

-- Grant SELECT to authenticated users (RLS still applies)
GRANT SELECT ON public.students_gated TO authenticated;

COMMENT ON VIEW public.students_gated IS
'Security-invoker view that gates fee_total and fee_due_date columns based on workspace permissions. Owners and members with fees:read or fees:write see real values; others see NULL. Frontend should migrate from students table to students_gated view for non-owner queries.';

-- The frontend will need to:
-- 1. Update all student queries for non-owners to use students_gated instead of students
-- 2. Keep owner queries on students table (better performance, no permission check)
-- 3. Handle NULL fee_total / fee_due_date in UI (already partially done with optional chaining)
