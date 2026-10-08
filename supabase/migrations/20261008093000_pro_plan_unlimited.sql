-- Make Pro plan unlimited for large centres
-- This allows large tier billing to activate Pro subscription with no student cap.
-- DO NOT APPLY this migration until after testing on Preview.

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
