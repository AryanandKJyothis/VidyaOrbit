CREATE OR REPLACE FUNCTION public.plan_student_limit(_plan public.plan_code)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE _plan
    WHEN 'free' THEN 25
    WHEN 'starter' THEN 100
    WHEN 'growth' THEN 500
    WHEN 'pro' THEN 1000
  END;
$$;
REVOKE EXECUTE ON FUNCTION public.plan_student_limit(public.plan_code) FROM PUBLIC, anon, authenticated;