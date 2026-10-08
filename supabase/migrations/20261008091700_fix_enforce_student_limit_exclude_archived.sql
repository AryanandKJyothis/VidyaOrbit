-- Fix student-limit counts to exclude archived students everywhere the
-- over-limit banner, import remaining-slots, and insert trigger read them.
-- Idempotent: CREATE OR REPLACE; grants/security settings preserved.

CREATE OR REPLACE FUNCTION public.enforce_student_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.plan_code;
  v_limit integer;
  v_count integer;
  v_plan_label text;
BEGIN
  v_plan := public.current_plan(NEW.owner_id);
  v_limit := public.plan_student_limit(v_plan);

  SELECT COUNT(*) INTO v_count
  FROM public.students
  WHERE owner_id = NEW.owner_id
    AND status IS DISTINCT FROM 'archived';

  IF v_count >= v_limit THEN
    v_plan_label := CASE v_plan
      WHEN 'pro' THEN 'Large'
      ELSE initcap(v_plan::text)
    END;
    RAISE EXCEPTION 'USER: You''ve reached your % plan limit of % students. Upgrade your plan to add more.', v_plan_label, v_limit;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_student_limit() IS
  'BEFORE INSERT ONLY on public.students. Enforces plan limit but excludes archived students from the count. Never touches existing rows: downgrading a plan never deletes students, batches, fees, or attendance. Owners simply cannot add NEW students until they trim or upgrade. Do NOT extend to UPDATE/DELETE. plan_code pro is labelled Large in the user-facing error.';

CREATE OR REPLACE FUNCTION public.subscription_health(_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_effective_plan public.plan_code;
  v_limit integer;
  v_count integer;
  v_days_left integer;
  v_expired boolean;
BEGIN
  IF auth.role() <> 'service_role' AND _uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT plan, status, start_date, expiry_date, plan_price, notes, current_period_end
    INTO v_sub
    FROM public.subscriptions
    WHERE owner_id = _uid
    LIMIT 1;

  v_effective_plan := public.current_plan(_uid);
  v_limit := public.plan_student_limit(v_effective_plan);

  SELECT COUNT(*) INTO v_count
    FROM public.students
   WHERE owner_id = _uid
     AND status IS DISTINCT FROM 'archived';

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

COMMENT ON FUNCTION public.subscription_health(uuid) IS
  'Plan/limit/expiry plus active (non-archived) student count. Must match enforce_student_limit. Later 094000 adds setup_fee_paid to this payload.';
