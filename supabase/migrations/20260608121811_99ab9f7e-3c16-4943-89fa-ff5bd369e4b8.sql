
-- 1) current_plan now also honors expiry_date < now() → free
CREATE OR REPLACE FUNCTION public.current_plan(_uid uuid)
RETURNS public.plan_code
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT CASE
       WHEN status NOT IN ('active','trialing') THEN 'free'::public.plan_code
       WHEN expiry_date IS NOT NULL AND expiry_date < now() THEN 'free'::public.plan_code
       ELSE plan
     END
     FROM public.subscriptions WHERE owner_id = _uid LIMIT 1),
    'free'::public.plan_code
  );
$$;

-- 2) Document the grandfathering contract on the limit trigger
COMMENT ON FUNCTION public.enforce_student_limit() IS
  'INSERT-only trigger. Never deletes or modifies existing students on downgrade — existing data is fully preserved. Only blocks new INSERTs once student_count >= plan limit. Do NOT extend to UPDATE/DELETE.';

-- 3) Single source of truth for subscription state used by client + admin
CREATE OR REPLACE FUNCTION public.subscription_health(_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_effective_plan public.plan_code;
  v_limit integer;
  v_count integer;
  v_days_left integer;
  v_expired boolean;
BEGIN
  SELECT plan, status, start_date, expiry_date, plan_price, notes, current_period_end
    INTO v_sub
    FROM public.subscriptions WHERE owner_id = _uid LIMIT 1;

  v_effective_plan := public.current_plan(_uid);
  v_limit := public.plan_student_limit(v_effective_plan);

  SELECT COUNT(*) INTO v_count FROM public.students WHERE owner_id = _uid;

  v_expired := v_sub.expiry_date IS NOT NULL AND v_sub.expiry_date < now();
  v_days_left := CASE
    WHEN v_sub.expiry_date IS NULL THEN NULL
    ELSE EXTRACT(DAY FROM (v_sub.expiry_date - now()))::int
  END;

  RETURN jsonb_build_object(
    'plan', v_effective_plan,
    'raw_plan', COALESCE(v_sub.plan, 'free'::public.plan_code),
    'status', COALESCE(v_sub.status, 'active'),
    'start_date', v_sub.start_date,
    'expiry_date', v_sub.expiry_date,
    'current_period_end', v_sub.current_period_end,
    'plan_price', v_sub.plan_price,
    'notes', v_sub.notes,
    'limit', v_limit,
    'student_count', v_count,
    'over_limit', v_count > v_limit,
    'over_by', GREATEST(0, v_count - v_limit),
    'days_until_expiry', v_days_left,
    'expired', v_expired
  );
END;
$$;

REVOKE ALL ON FUNCTION public.subscription_health(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.subscription_health(uuid) TO authenticated, service_role;
