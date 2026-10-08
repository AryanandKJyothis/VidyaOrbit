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
  v_setup_paid boolean;
  v_has_live boolean;
BEGIN
  -- Live semantics (null-safe): service_role is allowed. Otherwise auth.uid()
  -- IS NULL is forbidden. Allowed when _uid is the caller or a workspace they
  -- belong to, so invited staff inherit the institute plan.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL
       OR (
         auth.uid() IS DISTINCT FROM _uid
         AND NOT public.is_workspace_member(_uid, auth.uid())
       )
    THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- SELECT * so a re-run after 094000 still reads setup_fee_paid, while a
  -- first apply (column not yet added) does not fail.
  SELECT * INTO v_sub
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

  v_setup_paid := COALESCE((to_jsonb(v_sub)->>'setup_fee_paid')::boolean, false);
  v_has_live := false;
  IF to_regclass('public.billing_orders') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'billing_orders'
         AND column_name = 'key_mode'
    ) THEN
      EXECUTE
        'SELECT EXISTS (
           SELECT 1 FROM public.billing_orders bo
            WHERE bo.owner_id = $1
              AND bo.activated_at IS NOT NULL
              AND bo.key_mode = ''live''
         )'
        INTO v_has_live
        USING _uid;
    ELSE
      EXECUTE
        'SELECT EXISTS (
           SELECT 1 FROM public.billing_orders bo
            WHERE bo.owner_id = $1
              AND bo.activated_at IS NOT NULL
         )'
        INTO v_has_live
        USING _uid;
    END IF;
  END IF;
  v_setup_paid := v_setup_paid OR v_has_live;

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
    'expired', v_expired,
    'setup_fee_paid', v_setup_paid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.subscription_health(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.subscription_health(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.subscription_health(uuid) IS
  'Plan/limit/expiry plus active (non-archived) student count. Must match enforce_student_limit. Workspace members may read the owner''s plan. setup_fee_paid is the admin flag OR any live (key_mode=live) activated billing_orders row; test-mode captures do not count. Defensive: a first apply before 091800/094000 still works; a re-run after 094000 does not drop the field.';

-- Archived-student counts on admin/over-limit paths. Bodies match live except
-- student_count / total_students / apply_subscription_change v_count exclude
-- archived, and admin_institute_health_detail uses the F6 service_role guard.

CREATE OR REPLACE FUNCTION public.admin_institute_health_summary(_search text DEFAULT NULL::text)
 RETURNS TABLE(owner_id uuid, name text, contact_email text, member_emails text[], plan plan_code, status text, start_date timestamp with time zone, expiry_date timestamp with time zone, plan_price numeric, student_count bigint, plan_limit integer, days_until_expiry integer, last_active_at timestamp with time zone, last_active_source text, attendance_30d bigint, payments_30d bigint, students_30d bigint, batches_30d bigint, top_feature_30d text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Forbidden: admin only' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT i.owner_id, i.name, i.contact_email,
           s.plan, s.status, s.start_date, s.expiry_date, s.plan_price
    FROM public.institutes i
    LEFT JOIN public.subscriptions s ON s.owner_id = i.owner_id
    WHERE _search IS NULL
       OR i.name ILIKE '%'||_search||'%'
       OR i.contact_email ILIKE '%'||_search||'%'
  ),
  members AS (
    SELECT wm.owner_id,
      COALESCE(array_agg(DISTINCT u.email::text ORDER BY u.email::text) FILTER (WHERE u.email IS NOT NULL), ARRAY[]::text[]) AS member_emails
    FROM public.workspace_members wm
    JOIN base b ON b.owner_id = wm.owner_id
    LEFT JOIN auth.users u ON u.id = wm.user_id
    GROUP BY wm.owner_id
  ),
  s_agg AS (
    SELECT st.owner_id,
      COUNT(*) FILTER (WHERE st.status IS DISTINCT FROM 'archived')::bigint AS student_count,
      COUNT(*) FILTER (WHERE st.created_at > now() - interval '30 days')::bigint AS stu_30,
      MAX(st.created_at) AS last_stu
    FROM public.students st
    JOIN base b ON b.owner_id = st.owner_id
    GROUP BY st.owner_id
  ),
  a_agg AS (
    SELECT a.owner_id,
      COUNT(*) FILTER (WHERE a.created_at > now() - interval '30 days')::bigint AS att_30,
      MAX(a.created_at) AS last_att
    FROM public.attendance_sessions a
    JOIN base b ON b.owner_id = a.owner_id
    GROUP BY a.owner_id
  ),
  p_agg AS (
    SELECT p.owner_id,
      COUNT(*) FILTER (WHERE p.created_at > now() - interval '30 days')::bigint AS pay_30,
      MAX(p.created_at) AS last_pay
    FROM public.fee_payments p
    JOIN base b ON b.owner_id = p.owner_id
    GROUP BY p.owner_id
  ),
  b_agg AS (
    SELECT bt.owner_id,
      COUNT(*) FILTER (WHERE bt.updated_at > now() - interval '30 days')::bigint AS bat_30,
      MAX(bt.updated_at) AS last_bat
    FROM public.batches bt
    JOIN base b ON b.owner_id = bt.owner_id
    GROUP BY bt.owner_id
  )
  SELECT
    b.owner_id, b.name, b.contact_email, COALESCE(m.member_emails, ARRAY[]::text[]),
    b.plan, b.status, b.start_date, b.expiry_date, b.plan_price,
    COALESCE(s_agg.student_count, 0),
    public.plan_student_limit(COALESCE(b.plan, 'free'::public.plan_code)) AS plan_limit,
    CASE WHEN b.expiry_date IS NULL THEN NULL
         ELSE EXTRACT(DAY FROM (b.expiry_date - now()))::int END,
    GREATEST(
      COALESCE(a_agg.last_att, 'epoch'::timestamptz),
      COALESCE(p_agg.last_pay, 'epoch'::timestamptz),
      COALESCE(s_agg.last_stu, 'epoch'::timestamptz),
      COALESCE(b_agg.last_bat, 'epoch'::timestamptz)
    ),
    CASE GREATEST(
      COALESCE(a_agg.last_att, 'epoch'::timestamptz),
      COALESCE(p_agg.last_pay, 'epoch'::timestamptz),
      COALESCE(s_agg.last_stu, 'epoch'::timestamptz),
      COALESCE(b_agg.last_bat, 'epoch'::timestamptz)
    )
      WHEN a_agg.last_att THEN 'Attendance'
      WHEN p_agg.last_pay THEN 'Fees'
      WHEN s_agg.last_stu THEN 'Students'
      WHEN b_agg.last_bat THEN 'Batches'
      ELSE NULL
    END,
    COALESCE(a_agg.att_30, 0),
    COALESCE(p_agg.pay_30, 0),
    COALESCE(s_agg.stu_30, 0),
    COALESCE(b_agg.bat_30, 0),
    CASE
      WHEN GREATEST(COALESCE(a_agg.att_30,0), COALESCE(p_agg.pay_30,0), COALESCE(s_agg.stu_30,0), COALESCE(b_agg.bat_30,0)) = 0 THEN NULL
      WHEN COALESCE(a_agg.att_30,0) >= COALESCE(p_agg.pay_30,0) AND COALESCE(a_agg.att_30,0) >= COALESCE(s_agg.stu_30,0) AND COALESCE(a_agg.att_30,0) >= COALESCE(b_agg.bat_30,0) THEN 'Attendance'
      WHEN COALESCE(p_agg.pay_30,0) >= COALESCE(s_agg.stu_30,0) AND COALESCE(p_agg.pay_30,0) >= COALESCE(b_agg.bat_30,0) THEN 'Fees'
      WHEN COALESCE(s_agg.stu_30,0) >= COALESCE(b_agg.bat_30,0) THEN 'Students'
      ELSE 'Batches'
    END
  FROM base b
  LEFT JOIN members m ON m.owner_id = b.owner_id
  LEFT JOIN s_agg ON s_agg.owner_id = b.owner_id
  LEFT JOIN a_agg ON a_agg.owner_id = b.owner_id
  LEFT JOIN p_agg ON p_agg.owner_id = b.owner_id
  LEFT JOIN b_agg ON b_agg.owner_id = b.owner_id
  ORDER BY b.name;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_institute_health_summary(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_institute_health_summary(text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_institute_health_detail(_owner uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Forbidden: admin only' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'attendance_30d', (SELECT COUNT(*) FROM public.attendance_sessions WHERE owner_id=_owner AND created_at > now()-interval '30 days'),
    'attendance_90d', (SELECT COUNT(*) FROM public.attendance_sessions WHERE owner_id=_owner AND created_at > now()-interval '90 days'),
    'payments_30d',   (SELECT COUNT(*) FROM public.fee_payments WHERE owner_id=_owner AND created_at > now()-interval '30 days'),
    'payments_90d',   (SELECT COUNT(*) FROM public.fee_payments WHERE owner_id=_owner AND created_at > now()-interval '90 days'),
    'payments_amount_30d', (SELECT COALESCE(SUM(amount),0) FROM public.fee_payments WHERE owner_id=_owner AND created_at > now()-interval '30 days'),
    'students_30d',   (SELECT COUNT(*) FROM public.students WHERE owner_id=_owner AND created_at > now()-interval '30 days'),
    'students_90d',   (SELECT COUNT(*) FROM public.students WHERE owner_id=_owner AND created_at > now()-interval '90 days'),
    'batches_30d',    (SELECT COUNT(*) FROM public.batches WHERE owner_id=_owner AND updated_at > now()-interval '30 days'),
    'batches_90d',    (SELECT COUNT(*) FROM public.batches WHERE owner_id=_owner AND updated_at > now()-interval '90 days'),
    'last_attendance_at', (SELECT MAX(created_at) FROM public.attendance_sessions WHERE owner_id=_owner),
    'last_payment_at',    (SELECT MAX(created_at) FROM public.fee_payments WHERE owner_id=_owner),
    'last_student_at',    (SELECT MAX(created_at) FROM public.students WHERE owner_id=_owner),
    'last_batch_at',      (SELECT MAX(updated_at) FROM public.batches WHERE owner_id=_owner),
    'total_students',     (SELECT COUNT(*) FROM public.students WHERE owner_id=_owner AND status IS DISTINCT FROM 'archived'),
    'total_batches',      (SELECT COUNT(*) FROM public.batches WHERE owner_id=_owner)
  ) INTO v;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_institute_health_detail(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_institute_health_detail(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_subscription_change(_owner uuid, _changed_by uuid, _plan plan_code, _status text, _start timestamp with time zone, _expiry timestamp with time zone, _price numeric, _notes text, _note text, _confirm boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_before record;
  v_limit integer;
  v_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Forbidden: admin only' USING ERRCODE = '42501';
    END IF;
  END IF;

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

  v_limit := public.plan_student_limit(_plan);
  SELECT COUNT(*) INTO v_count FROM public.students WHERE owner_id = _owner AND status IS DISTINCT FROM 'archived';
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
$function$;

REVOKE ALL ON FUNCTION public.apply_subscription_change(uuid, uuid, public.plan_code, text, timestamptz, timestamptz, numeric, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_change(uuid, uuid, public.plan_code, text, timestamptz, timestamptz, numeric, text, text, boolean) TO service_role;
