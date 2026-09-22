
-- 1. Normalize legacy status values
UPDATE public.subscriptions SET status = 'trialing'  WHERE status = 'trial';
UPDATE public.subscriptions SET status = 'canceled'  WHERE status IN ('expired','suspended');

-- 2. Single-transaction apply helper
CREATE OR REPLACE FUNCTION public.apply_subscription_change(
  _owner uuid,
  _changed_by uuid,
  _plan public.plan_code,
  _status text,
  _start timestamptz,
  _expiry timestamptz,
  _price numeric,
  _notes text,
  _note text,
  _confirm boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before record;
  v_limit integer;
  v_count integer;
BEGIN
  IF _status NOT IN ('active','trialing','past_due','canceled','pending_checkout') THEN
    RAISE EXCEPTION 'Invalid status %', _status;
  END IF;

  IF _start IS NOT NULL AND _expiry IS NOT NULL AND _expiry <= _start THEN
    RAISE EXCEPTION 'Expiry date must be after start date';
  END IF;

  IF _status = 'active' AND _expiry IS NOT NULL AND _expiry < now() THEN
    RAISE EXCEPTION 'Cannot mark subscription active with an expiry date in the past';
  END IF;

  SELECT plan, status, start_date, expiry_date, plan_price, notes
    INTO v_before
    FROM public.subscriptions WHERE owner_id = _owner LIMIT 1;

  -- Over-limit guardrail (only when not already confirmed)
  v_limit := public.plan_student_limit(_plan);
  SELECT COUNT(*) INTO v_count FROM public.students WHERE owner_id = _owner;
  IF v_count > v_limit AND NOT _confirm THEN
    RETURN jsonb_build_object(
      'requires_confirmation', true,
      'student_count', v_count,
      'new_limit', v_limit,
      'over_by', v_count - v_limit,
      'new_plan', _plan
    );
  END IF;

  INSERT INTO public.subscriptions (owner_id, plan, status, start_date, expiry_date, plan_price, notes, updated_by, updated_at)
  VALUES (_owner, _plan, _status, _start, _expiry, _price, _notes, _changed_by, now())
  ON CONFLICT (owner_id) DO UPDATE
    SET plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        start_date = EXCLUDED.start_date,
        expiry_date = EXCLUDED.expiry_date,
        plan_price = EXCLUDED.plan_price,
        notes = EXCLUDED.notes,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at;

  INSERT INTO public.subscription_audit (
    owner_id, changed_by, old_plan, new_plan, old_status, new_status,
    old_expiry, new_expiry, old_price, new_price, note
  ) VALUES (
    _owner, _changed_by,
    v_before.plan, _plan,
    v_before.status, _status,
    v_before.expiry_date, _expiry,
    v_before.plan_price, _price,
    COALESCE(_note, 'Manual update')
      || CASE WHEN v_count > v_limit
           THEN format(' [over-limit: %s students vs new cap %s]', v_count, v_limit)
           ELSE '' END
  );

  RETURN jsonb_build_object(
    'ok', true,
    'plan', _plan,
    'status', _status,
    'expiry_date', _expiry,
    'student_count', v_count,
    'limit', v_limit,
    'over_limit', v_count > v_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_subscription_change(uuid,uuid,public.plan_code,text,timestamptz,timestamptz,numeric,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_subscription_change(uuid,uuid,public.plan_code,text,timestamptz,timestamptz,numeric,text,text,boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.enforce_student_limit() IS
  'BEFORE INSERT ONLY on public.students. Never touches existing rows: downgrading a plan never deletes students, batches, fees, or attendance. Owners simply cannot add NEW students until they trim or upgrade. Do NOT extend to UPDATE/DELETE.';
