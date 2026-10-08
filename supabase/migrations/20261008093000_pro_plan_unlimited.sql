-- Make Pro plan unlimited for large centres.
-- This allows large tier billing to activate Pro subscription with no student cap.
-- Already applied on production as `pro_plan_unlimited`. Keep this file so the
-- repo matches the DB. Idempotent and safe to re-run: CREATE OR REPLACE only
-- (grants and callers are unchanged).
-- Preview uses the production database, so this is applied together with the
-- other billing migrations in the approved order (091700, 091800, 093000, 094000)
-- — not as a later follow-up after Preview testing.

-- Update plan_student_limit function to return unlimited for Pro
CREATE OR REPLACE FUNCTION public.plan_student_limit(_plan public.plan_code)
RETURNS integer
LANGUAGE sql 
IMMUTABLE 
SET search_path = public
AS $$
  SELECT CASE _plan
    WHEN 'free' THEN 25
    WHEN 'starter' THEN 100
    WHEN 'growth' THEN 500
    WHEN 'pro' THEN 2147483647
  END;
$$;
