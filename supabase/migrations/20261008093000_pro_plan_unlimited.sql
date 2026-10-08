-- Make Pro plan unlimited for large centres
-- This allows large tier billing to activate Pro subscription with no student cap.
-- DO NOT APPLY this migration until after testing on Preview.

-- Update plan_student_limit function to return unlimited for Pro
CREATE OR REPLACE FUNCTION public.plan_student_limit(_plan public.plan_code)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE _plan
    WHEN 'free' THEN 25
    WHEN 'starter' THEN 100
    WHEN 'growth' THEN 500
    WHEN 'pro' THEN 2147483647  -- Unlimited (max safe integer)
  END;
$$;

COMMENT ON FUNCTION public.plan_student_limit(public.plan_code) IS
  'Returns student limit for each plan code. Pro is unlimited (2147483647).';
