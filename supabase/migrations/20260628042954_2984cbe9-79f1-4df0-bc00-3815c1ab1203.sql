CREATE OR REPLACE FUNCTION public.subscription_health(_uid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sub record;
  v_effective_plan public.plan_code;
  v_limit integer;
  v_count integer;
  v_days_left integer;
  v_expired boolean;
BEGIN
  -- Allow: the owner themselves, or any workspace member of that owner.
  -- This way invited staff inherit the institute's plan/limit when they
  -- switch into that workspace.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() <> _uid AND NOT public.is_workspace_member(_uid, auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

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
$function$;