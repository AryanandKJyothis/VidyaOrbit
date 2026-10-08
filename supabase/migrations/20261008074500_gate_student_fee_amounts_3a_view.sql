-- Migration 3a: Create students_gated security definer view
-- APPLY ORDER: This file first, then deploy frontend reading via view, then 3b.
-- DO NOT apply 3b until frontend is deployed and confirmed working.

-- Security definer view that gates fee columns based on workspace permission
CREATE OR REPLACE VIEW public.students_gated 
WITH (security_invoker=false, security_barrier=true) AS
SELECT 
  s.id,
  s.owner_id,
  s.full_name,
  s.phone,
  s.guardian_name,
  s.guardian_phone,
  s.address,
  s.joining_date,
  s.status,
  s.batch_id,
  s.notes,
  s.created_at,
  s.updated_at,
  CASE WHEN public.has_resource_access(s.owner_id, auth.uid(), 'fees', false) 
    THEN s.fee_total 
  END AS fee_total,
  CASE WHEN public.has_resource_access(s.owner_id, auth.uid(), 'fees', false) 
    THEN s.fee_due_date 
  END AS fee_due_date
FROM public.students s 
WHERE public.has_resource_access(s.owner_id, auth.uid(), 'students', false);

-- Secure the view: revoke all, grant only SELECT to authenticated
REVOKE ALL ON public.students_gated FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.students_gated TO authenticated;
