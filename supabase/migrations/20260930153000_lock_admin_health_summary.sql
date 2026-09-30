-- The July 2026 migrations drop and recreate admin_institute_health_summary.
-- A new function is executable by PUBLIC, and the guard skips the admin
-- check when auth.uid() is null, so the anon key can read every institute.
-- Service role (server admin client) has a null uid and must still be allowed.
-- Authenticated non-admins and anon must not.

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
      COUNT(*)::bigint AS student_count,
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

-- Same null-uid hole. These two are revoked later in history, then left in
-- place. Repeat the revoke and close the guard so a fresh apply cannot leave
-- them callable by anon.
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
$function$;

REVOKE ALL ON FUNCTION public.apply_subscription_change(uuid, uuid, public.plan_code, text, timestamptz, timestamptz, numeric, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_change(uuid, uuid, public.plan_code, text, timestamptz, timestamptz, numeric, text, text, boolean) TO service_role;
