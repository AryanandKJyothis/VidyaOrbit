-- Founder admin panel: exclude platform-admin accounts from metrics.
-- New versions of the read-only SECURITY DEFINER RPCs. No new tables.
-- Filter is role-based (public.has_role(uid, 'admin') / user_roles.role =
-- 'admin'), never a hardcoded email. Admins, the centres they own, and
-- their billing orders are omitted from every count, list, and alert.
-- Service-role execute only. Do not grant EXECUTE to authenticated.

-- ── overview ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_platform_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Forbidden: admin only' USING ERRCODE = '42501';
    END IF;
  END IF;

  WITH last_live AS (
    SELECT DISTINCT ON (bo.owner_id)
      bo.owner_id, bo.cycle
    FROM public.billing_orders bo
    WHERE bo.status = 'paid'
      AND bo.key_mode = 'live'
      AND bo.activated_at IS NOT NULL
      AND NOT public.has_role(bo.owner_id, 'admin')
    ORDER BY bo.owner_id, bo.paid_at DESC NULLS LAST
  ),
  centres AS (
    SELECT
      i.owner_id,
      COALESCE(s.plan, 'free'::public.plan_code) AS plan,
      COALESCE(s.status, 'active') AS status,
      s.expiry_date,
      CASE
        WHEN COALESCE(s.status, 'active') NOT IN ('active', 'trialing') THEN 'free'::public.plan_code
        WHEN s.expiry_date IS NOT NULL AND s.expiry_date < now() THEN 'free'::public.plan_code
        ELSE COALESCE(s.plan, 'free'::public.plan_code)
      END AS effective_plan,
      CASE
        WHEN COALESCE(s.status, 'active') = 'active'
         AND COALESCE(s.plan, 'free'::public.plan_code) <> 'free'::public.plan_code
         AND (s.expiry_date IS NULL OR s.expiry_date > now())
        THEN true ELSE false
      END AS paying,
      CASE
        WHEN COALESCE(s.status, 'active') = 'active'
         AND COALESCE(s.plan, 'free'::public.plan_code) <> 'free'::public.plan_code
         AND (s.expiry_date IS NULL OR s.expiry_date > now())
        THEN
          CASE COALESCE(ll.cycle, 'monthly')
            WHEN 'annual' THEN
              CASE COALESCE(s.plan, 'free'::public.plan_code)
                WHEN 'starter' THEN round(499900::numeric / 12)
                WHEN 'growth' THEN round(1000000::numeric / 12)
                WHEN 'pro' THEN round(2500000::numeric / 12)
                ELSE 0
              END
            ELSE
              CASE COALESCE(s.plan, 'free'::public.plan_code)
                WHEN 'starter' THEN 49900
                WHEN 'growth' THEN 99900
                WHEN 'pro' THEN 249900
                ELSE 0
              END
          END
        ELSE 0
      END AS mrr_paise,
      (SELECT COUNT(*) FROM public.students st
        WHERE st.owner_id = i.owner_id
          AND st.status IS DISTINCT FROM 'archived') AS student_count
    FROM public.institutes i
    LEFT JOIN public.subscriptions s ON s.owner_id = i.owner_id
    LEFT JOIN last_live ll ON ll.owner_id = i.owner_id
    WHERE NOT public.has_role(i.owner_id, 'admin')
  ),
  days AS (
    SELECT generate_series(
      ((now() AT TIME ZONE 'utc')::date - 13),
      (now() AT TIME ZONE 'utc')::date,
      interval '1 day'
    )::date AS day
  ),
  trend AS (
    SELECT
      d.day,
      (SELECT COUNT(*) FROM auth.users u
        WHERE u.created_at >= d.day::timestamptz
          AND u.created_at < (d.day + 1)::timestamptz
          AND NOT public.has_role(u.id, 'admin')) AS users,
      (SELECT COUNT(*) FROM public.institutes i
        WHERE i.created_at >= d.day::timestamptz
          AND i.created_at < (d.day + 1)::timestamptz
          AND NOT public.has_role(i.owner_id, 'admin')) AS centres
    FROM days d
  )
  SELECT jsonb_build_object(
    'centres', (SELECT COUNT(*) FROM public.institutes i WHERE NOT public.has_role(i.owner_id, 'admin')),
    'users', (SELECT COUNT(*) FROM auth.users u WHERE NOT public.has_role(u.id, 'admin')),
    'active_users_7d', (SELECT COUNT(*) FROM auth.users u WHERE u.last_sign_in_at > now() - interval '7 days' AND NOT public.has_role(u.id, 'admin')),
    'active_users_30d', (SELECT COUNT(*) FROM auth.users u WHERE u.last_sign_in_at > now() - interval '30 days' AND NOT public.has_role(u.id, 'admin')),
    'signups_7d', (SELECT COUNT(*) FROM auth.users u WHERE u.created_at > now() - interval '7 days' AND NOT public.has_role(u.id, 'admin')),
    'signups_30d', (SELECT COUNT(*) FROM auth.users u WHERE u.created_at > now() - interval '30 days' AND NOT public.has_role(u.id, 'admin')),
    'centre_signups_7d', (SELECT COUNT(*) FROM public.institutes i WHERE i.created_at > now() - interval '7 days' AND NOT public.has_role(i.owner_id, 'admin')),
    'centre_signups_30d', (SELECT COUNT(*) FROM public.institutes i WHERE i.created_at > now() - interval '30 days' AND NOT public.has_role(i.owner_id, 'admin')),
    'signup_trend', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'day', t.day, 'users', t.users, 'centres', t.centres
      ) ORDER BY t.day), '[]'::jsonb) FROM trend t),
    'mrr_paise', (SELECT COALESCE(SUM(c.mrr_paise), 0) FROM centres c),
    'revenue_30d_paise', (
      SELECT COALESCE(SUM(bo.amount_paise), 0)
      FROM public.billing_orders bo
      WHERE bo.status = 'paid'
        AND bo.key_mode = 'live'
        AND bo.paid_at > now() - interval '30 days'
        AND NOT public.has_role(bo.owner_id, 'admin')
    ),
    'plan_mix', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('plan', x.effective_plan, 'count', x.n) ORDER BY x.effective_plan), '[]'::jsonb)
      FROM (
        SELECT effective_plan, COUNT(*) AS n FROM centres GROUP BY effective_plan
      ) x
    ),
    'trials', (SELECT COUNT(*) FROM centres c WHERE c.status = 'trialing'),
    'trials_ending_7d', (
      SELECT COUNT(*) FROM centres c
      WHERE c.status = 'trialing'
        AND c.expiry_date IS NOT NULL
        AND c.expiry_date > now()
        AND c.expiry_date <= now() + interval '7 days'
    ),
    'expiring_7d', (
      SELECT COUNT(*) FROM centres c
      WHERE c.expiry_date IS NOT NULL
        AND c.expiry_date > now()
        AND c.expiry_date <= now() + interval '7 days'
    ),
    'expiring_30d', (
      SELECT COUNT(*) FROM centres c
      WHERE c.expiry_date IS NOT NULL
        AND c.expiry_date > now()
        AND c.expiry_date <= now() + interval '30 days'
    ),
    'over_limit', (
      SELECT COUNT(*) FROM centres c
      WHERE c.student_count > public.plan_student_limit(c.effective_plan)
    ),
    'needs_review', (
      SELECT COUNT(*) FROM public.billing_orders bo
      WHERE bo.needs_review
        AND NOT public.has_role(bo.owner_id, 'admin')
    ),
    'webhook_errors', (
      SELECT COUNT(*) FROM public.razorpay_webhook_deliveries d
      WHERE d.handled = false AND d.error IS NOT NULL
        AND NOT public.has_role(d.owner_id, 'admin')
    ),
    'paying', (SELECT COUNT(*) FROM centres c WHERE c.paying)
  ) INTO v;

  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_platform_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_platform_overview() TO service_role;

-- ── centres list ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_centres_list(
  _search text DEFAULT NULL,
  _filter text DEFAULT 'all',
  _sort text DEFAULT 'name',
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_limit integer;
  v_offset integer;
  v_filter text;
  v_sort text;
  v_search text;
  v jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Forbidden: admin only' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(_limit, 50), 100));
  v_offset := GREATEST(0, COALESCE(_offset, 0));
  v_filter := COALESCE(NULLIF(trim(_filter), ''), 'all');
  v_sort := COALESCE(NULLIF(trim(_sort), ''), 'name');
  v_search := NULLIF(trim(_search), '');

  WITH base AS (
    SELECT
      i.owner_id,
      i.name,
      i.contact_email,
      i.contact_phone,
      i.created_at,
      ou.email::text AS owner_email,
      ou.last_sign_in_at AS owner_last_sign_in_at,
      s.plan, s.status, s.start_date, s.expiry_date, s.plan_price,
      COALESCE(s.setup_fee_paid, false) AS setup_fee_paid
    FROM public.institutes i
    LEFT JOIN public.subscriptions s ON s.owner_id = i.owner_id
    LEFT JOIN auth.users ou ON ou.id = i.owner_id
    WHERE NOT public.has_role(i.owner_id, 'admin')
  ),
  members AS (
    SELECT wm.owner_id,
      COALESCE(array_agg(DISTINCT u.email::text ORDER BY u.email::text) FILTER (WHERE u.email IS NOT NULL), ARRAY[]::text[]) AS member_emails,
      COUNT(*)::int AS member_count,
      COUNT(*) FILTER (WHERE wm.role IS DISTINCT FROM 'owner')::int AS staff_count
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
  ),
  last_live AS (
    SELECT DISTINCT ON (bo.owner_id)
      bo.owner_id,
      bo.paid_at,
      bo.amount_paise,
      bo.tier,
      bo.cycle
    FROM public.billing_orders bo
    JOIN base b ON b.owner_id = bo.owner_id
    WHERE bo.status = 'paid' AND bo.key_mode = 'live'
      AND NOT public.has_role(bo.owner_id, 'admin')
    ORDER BY bo.owner_id, bo.paid_at DESC NULLS LAST
  ),
  review AS (
    SELECT bo.owner_id, COUNT(*)::int AS needs_review_count
    FROM public.billing_orders bo
    JOIN base b ON b.owner_id = bo.owner_id
    WHERE bo.needs_review
      AND NOT public.has_role(bo.owner_id, 'admin')
    GROUP BY bo.owner_id
  ),
  assembled AS (
    SELECT
      b.owner_id, b.name, b.contact_email, b.contact_phone, b.created_at,
      b.owner_email, b.owner_last_sign_in_at,
      COALESCE(m.member_emails, ARRAY[]::text[]) AS member_emails,
      COALESCE(m.staff_count, 0) AS staff_count,
      COALESCE(m.member_count, 0) AS member_count,
      b.plan, b.status, b.start_date, b.expiry_date, b.plan_price, b.setup_fee_paid,
      COALESCE(s_agg.student_count, 0) AS student_count,
      public.plan_student_limit(COALESCE(b.plan, 'free'::public.plan_code)) AS plan_limit,
      CASE WHEN b.expiry_date IS NULL THEN NULL
           ELSE EXTRACT(DAY FROM (b.expiry_date - now()))::int END AS days_until_expiry,
      GREATEST(
        COALESCE(a_agg.last_att, 'epoch'::timestamptz),
        COALESCE(p_agg.last_pay, 'epoch'::timestamptz),
        COALESCE(s_agg.last_stu, 'epoch'::timestamptz),
        COALESCE(b_agg.last_bat, 'epoch'::timestamptz)
      ) AS last_active_at,
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
      END AS last_active_source,
      COALESCE(a_agg.att_30, 0) AS attendance_30d,
      COALESCE(p_agg.pay_30, 0) AS payments_30d,
      COALESCE(s_agg.stu_30, 0) AS students_30d,
      COALESCE(b_agg.bat_30, 0) AS batches_30d,
      CASE
        WHEN GREATEST(COALESCE(a_agg.att_30,0), COALESCE(p_agg.pay_30,0), COALESCE(s_agg.stu_30,0), COALESCE(b_agg.bat_30,0)) = 0 THEN NULL
        WHEN COALESCE(a_agg.att_30,0) >= COALESCE(p_agg.pay_30,0) AND COALESCE(a_agg.att_30,0) >= COALESCE(s_agg.stu_30,0) AND COALESCE(a_agg.att_30,0) >= COALESCE(b_agg.bat_30,0) THEN 'Attendance'
        WHEN COALESCE(p_agg.pay_30,0) >= COALESCE(s_agg.stu_30,0) AND COALESCE(p_agg.pay_30,0) >= COALESCE(b_agg.bat_30,0) THEN 'Fees'
        WHEN COALESCE(s_agg.stu_30,0) >= COALESCE(b_agg.bat_30,0) THEN 'Students'
        ELSE 'Batches'
      END AS top_feature_30d,
      ll.paid_at AS last_payment_at,
      ll.amount_paise AS last_payment_amount_paise,
      ll.tier AS last_payment_tier,
      ll.cycle AS last_payment_cycle,
      COALESCE(rv.needs_review_count, 0) AS needs_review_count
    FROM base b
    LEFT JOIN members m ON m.owner_id = b.owner_id
    LEFT JOIN s_agg ON s_agg.owner_id = b.owner_id
    LEFT JOIN a_agg ON a_agg.owner_id = b.owner_id
    LEFT JOIN p_agg ON p_agg.owner_id = b.owner_id
    LEFT JOIN b_agg ON b_agg.owner_id = b.owner_id
    LEFT JOIN last_live ll ON ll.owner_id = b.owner_id
    LEFT JOIN review rv ON rv.owner_id = b.owner_id
  ),
  filtered AS (
    SELECT a.*
    FROM assembled a
    WHERE (
      v_search IS NULL
      OR a.name ILIKE '%'||v_search||'%'
      OR COALESCE(a.contact_email, '') ILIKE '%'||v_search||'%'
      OR COALESCE(a.contact_phone, '') ILIKE '%'||v_search||'%'
      OR COALESCE(a.owner_email, '') ILIKE '%'||v_search||'%'
    )
    AND (
      v_filter = 'all'
      OR (v_filter = 'expiring' AND a.expiry_date IS NOT NULL AND a.expiry_date <= now() + interval '30 days')
      OR (v_filter = 'over_limit' AND a.student_count > a.plan_limit)
      OR (v_filter = 'at_risk' AND a.last_active_at IS NOT NULL
          AND a.last_active_at < now() - interval '7 days'
          AND a.last_active_at >= now() - interval '30 days'
          AND a.last_active_at > 'epoch'::timestamptz)
      OR (v_filter = 'inactive' AND (a.last_active_at IS NULL OR a.last_active_at <= 'epoch'::timestamptz OR a.last_active_at < now() - interval '30 days'))
      OR (v_filter = 'trials' AND a.status = 'trialing')
      OR (v_filter = 'free' AND COALESCE(a.plan, 'free'::public.plan_code) = 'free'::public.plan_code)
    )
  ),
  ordered AS (
    SELECT f.*,
      CASE
        WHEN v_sort = 'expiring' THEN 0
        WHEN v_sort = 'most_students' THEN 1
        WHEN v_sort = 'least_active' THEN 2
        WHEN v_sort = 'recently_active' THEN 3
        ELSE 4
      END AS sort_bucket
    FROM filtered f
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM filtered),
    'rows', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) - 'sort_bucket')
      FROM (
        SELECT *
        FROM ordered
        ORDER BY
          CASE WHEN v_sort = 'expiring' THEN COALESCE(days_until_expiry, 2147483647) END ASC NULLS LAST,
          CASE WHEN v_sort = 'most_students' THEN student_count END DESC,
          CASE WHEN v_sort = 'least_active' THEN last_active_at END ASC NULLS FIRST,
          CASE WHEN v_sort = 'recently_active' THEN last_active_at END DESC NULLS LAST,
          name ASC
        LIMIT v_limit OFFSET v_offset
      ) x
    ), '[]'::jsonb)
  ) INTO v;

  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_centres_list(text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_centres_list(text, text, text, integer, integer) TO service_role;

-- ── users list ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_users_list(
  _search text DEFAULT NULL,
  _filter text DEFAULT 'all',
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_limit integer;
  v_offset integer;
  v_filter text;
  v_search text;
  v jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Forbidden: admin only' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(_limit, 50), 100));
  v_offset := GREATEST(0, COALESCE(_offset, 0));
  v_filter := COALESCE(NULLIF(trim(_filter), ''), 'all');
  v_search := NULLIF(trim(_search), '');

  WITH memberships AS (
    SELECT
      wm.user_id,
      jsonb_agg(jsonb_build_object(
        'owner_id', wm.owner_id,
        'name', COALESCE(i.name, 'Workspace'),
        'role', wm.role,
        'is_own', wm.owner_id = wm.user_id
      ) ORDER BY i.name) AS centres,
      bool_or(wm.owner_id IS DISTINCT FROM wm.user_id) AS is_staff_elsewhere
    FROM public.workspace_members wm
    LEFT JOIN public.institutes i ON i.owner_id = wm.owner_id
    WHERE NOT public.has_role(wm.owner_id, 'admin')
    GROUP BY wm.user_id
  ),
  assembled AS (
    SELECT
      u.id AS user_id,
      u.email::text AS email,
      NULLIF(trim(COALESCE(u.raw_user_meta_data->>'full_name', '')), '') AS full_name,
      COALESCE(
        NULLIF(trim(COALESCE(u.raw_user_meta_data->>'phone', '')), ''),
        i.contact_phone
      ) AS phone,
      u.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at,
      COALESCE((u.raw_user_meta_data->>'joining_team')::boolean, false) AS joining_team,
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = u.id AND ur.role = 'admin'
      ) AS platform_admin,
      i.owner_id IS NOT NULL AS owns_centre,
      (i.owner_id IS NULL AND COALESCE(m.is_staff_elsewhere, false) = false) AS orphan,
      COALESCE(m.centres, '[]'::jsonb) AS centres
    FROM auth.users u
    LEFT JOIN public.institutes i ON i.owner_id = u.id
    LEFT JOIN memberships m ON m.user_id = u.id
    WHERE NOT public.has_role(u.id, 'admin')
  ),
  filtered AS (
    SELECT a.*
    FROM assembled a
    WHERE (
      v_search IS NULL
      OR COALESCE(a.email, '') ILIKE '%'||v_search||'%'
      OR COALESCE(a.full_name, '') ILIKE '%'||v_search||'%'
      OR COALESCE(a.phone, '') ILIKE '%'||v_search||'%'
      OR a.centres::text ILIKE '%'||v_search||'%'
    )
    AND (
      v_filter = 'all'
      OR (v_filter = 'owners' AND a.owns_centre)
      OR (v_filter = 'staff' AND a.centres <> '[]'::jsonb AND a.owns_centre = false)
      OR (v_filter = 'orphan' AND a.orphan)
      OR (v_filter = 'admin' AND a.platform_admin)
      OR (v_filter = 'unconfirmed' AND a.email_confirmed_at IS NULL)
    )
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM filtered),
    'rows', COALESCE((
      SELECT jsonb_agg(to_jsonb(x))
      FROM (
        SELECT * FROM filtered
        ORDER BY created_at DESC NULLS LAST
        LIMIT v_limit OFFSET v_offset
      ) x
    ), '[]'::jsonb)
  ) INTO v;

  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_users_list(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_users_list(text, text, integer, integer) TO service_role;

-- ── user detail ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_user_detail(_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Forbidden: admin only' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'user', (
      SELECT to_jsonb(u) FROM (
        SELECT
          au.id AS user_id,
          au.email::text AS email,
          NULLIF(trim(COALESCE(au.raw_user_meta_data->>'full_name', '')), '') AS full_name,
          COALESCE(
            NULLIF(trim(COALESCE(au.raw_user_meta_data->>'phone', '')), ''),
            inst.contact_phone
          ) AS phone,
          au.created_at,
          au.last_sign_in_at,
          au.email_confirmed_at,
          COALESCE((au.raw_user_meta_data->>'joining_team')::boolean, false) AS joining_team,
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = au.id AND ur.role = 'admin'
          ) AS platform_admin,
          inst.owner_id IS NOT NULL AS owns_centre,
          (inst.owner_id IS NULL AND NOT EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.user_id = au.id AND wm.owner_id IS DISTINCT FROM au.id
          )) AS orphan
        FROM auth.users au
        LEFT JOIN public.institutes inst ON inst.owner_id = au.id
        WHERE au.id = _user
          AND NOT public.has_role(au.id, 'admin')
      ) u
    ),
    'centres', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'owner_id', wm.owner_id,
        'name', COALESCE(i.name, 'Workspace'),
        'role', wm.role,
        'is_own', wm.owner_id = wm.user_id,
        'permissions', wm.permissions,
        'created_at', wm.created_at
      ) ORDER BY i.name), '[]'::jsonb)
      FROM public.workspace_members wm
      LEFT JOIN public.institutes i ON i.owner_id = wm.owner_id
      WHERE wm.user_id = _user
    ),
    'subscription', (
      SELECT to_jsonb(s)
      FROM public.subscriptions s
      WHERE s.owner_id = _user
        AND EXISTS (SELECT 1 FROM public.institutes i WHERE i.owner_id = _user)
    ),
    'institute', (
      SELECT jsonb_build_object(
        'name', i.name,
        'contact_email', i.contact_email,
        'contact_phone', i.contact_phone,
        'created_at', i.created_at,
        'timezone', i.timezone,
        'address', i.address
      )
      FROM public.institutes i
      WHERE i.owner_id = _user
    ),
    'payments', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', bo.id,
        'owner_id', bo.owner_id,
        'razorpay_order_id', bo.razorpay_order_id,
        'razorpay_payment_id', bo.razorpay_payment_id,
        'intent', bo.intent,
        'amount_paise', bo.amount_paise,
        'currency', bo.currency,
        'status', bo.status,
        'tier', bo.tier,
        'cycle', bo.cycle,
        'key_mode', bo.key_mode,
        'created_at', bo.created_at,
        'paid_at', bo.paid_at,
        'activated_at', bo.activated_at,
        'needs_review', bo.needs_review,
        'review_reason', bo.review_reason
      ) ORDER BY bo.created_at DESC), '[]'::jsonb)
      FROM public.billing_orders bo
      WHERE bo.owner_id = _user
    ),
    'invites', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', wi.id,
        'email', wi.email,
        'role', wi.role,
        'status', wi.status,
        'expires_at', wi.expires_at,
        'created_at', wi.created_at,
        'accepted_at', wi.accepted_at,
        'owner_id', wi.owner_id
      ) ORDER BY wi.created_at DESC), '[]'::jsonb)
      FROM public.workspace_invites wi
      WHERE wi.owner_id = _user
         OR lower(wi.email) = lower(COALESCE((
           SELECT u.email::text FROM auth.users u WHERE u.id = _user
         ), ''))
    )
  ) INTO v;

  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_user_detail(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(uuid) TO service_role;

-- ── payments list ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_payments_list(
  _search text DEFAULT NULL,
  _filter text DEFAULT 'all',
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_limit integer;
  v_offset integer;
  v_filter text;
  v_search text;
  v jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Forbidden: admin only' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(_limit, 50), 100));
  v_offset := GREATEST(0, COALESCE(_offset, 0));
  v_filter := COALESCE(NULLIF(trim(_filter), ''), 'all');
  v_search := NULLIF(trim(_search), '');

  WITH assembled AS (
    SELECT
      bo.id,
      bo.owner_id,
      i.name AS centre_name,
      bo.razorpay_order_id,
      bo.razorpay_payment_id,
      bo.intent,
      bo.amount_paise,
      bo.currency,
      bo.status,
      bo.tier,
      bo.cycle,
      bo.key_mode,
      bo.created_at,
      bo.paid_at,
      bo.activated_at,
      bo.needs_review,
      bo.review_reason
    FROM public.billing_orders bo
    LEFT JOIN public.institutes i ON i.owner_id = bo.owner_id
    WHERE NOT public.has_role(bo.owner_id, 'admin')
  ),
  filtered AS (
    SELECT a.*
    FROM assembled a
    WHERE (
      v_search IS NULL
      OR COALESCE(a.centre_name, '') ILIKE '%'||v_search||'%'
      OR COALESCE(a.razorpay_order_id, '') ILIKE '%'||v_search||'%'
      OR COALESCE(a.razorpay_payment_id, '') ILIKE '%'||v_search||'%'
    )
    AND (
      v_filter = 'all'
      OR (v_filter = 'live' AND a.key_mode = 'live')
      OR (v_filter = 'test' AND a.key_mode = 'test')
      OR (v_filter = 'paid' AND a.status = 'paid')
      OR (v_filter = 'needs_review' AND a.needs_review)
      OR (v_filter = 'failed' AND a.status = 'failed')
      OR (v_filter = 'created' AND a.status = 'created')
    )
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM filtered),
    'rows', COALESCE((
      SELECT jsonb_agg(to_jsonb(x))
      FROM (
        SELECT * FROM filtered
        ORDER BY COALESCE(paid_at, created_at) DESC NULLS LAST
        LIMIT v_limit OFFSET v_offset
      ) x
    ), '[]'::jsonb)
  ) INTO v;

  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_payments_list(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_payments_list(text, text, integer, integer) TO service_role;

-- ── alerts ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_alerts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Forbidden: admin only' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(x.alert ORDER BY
      CASE (x.alert->>'severity')
        WHEN 'danger' THEN 0
        WHEN 'warning' THEN 1
        ELSE 2
      END,
      x.alert->>'title'
    ), '[]'::jsonb)
  INTO v
  FROM (
    SELECT jsonb_build_object(
      'kind', 'needs_review',
      'severity', 'danger',
      'title', 'Paid order needs review',
      'detail', bo.review_reason,
      'owner_id', bo.owner_id,
      'name', i.name,
      'href', '/admin/centres'
    ) AS alert
    FROM public.billing_orders bo
    LEFT JOIN public.institutes i ON i.owner_id = bo.owner_id
    WHERE bo.needs_review
      AND NOT public.has_role(bo.owner_id, 'admin')

    UNION ALL

    SELECT jsonb_build_object(
      'kind', 'webhook_error',
      'severity', 'danger',
      'title', 'Webhook delivery failed',
      'detail', d.error,
      'owner_id', d.owner_id,
      'name', i.name,
      'href', '/admin/payments'
    )
    FROM public.razorpay_webhook_deliveries d
    LEFT JOIN public.institutes i ON i.owner_id = d.owner_id
    WHERE d.handled = false AND d.error IS NOT NULL
      AND NOT public.has_role(d.owner_id, 'admin')

    UNION ALL

    SELECT jsonb_build_object(
      'kind', 'over_limit',
      'severity', 'warning',
      'title', 'Over student cap',
      'detail', format('%s students on %s', cnt.n, COALESCE(s.plan::text, 'free')),
      'owner_id', i.owner_id,
      'name', i.name,
      'href', '/admin/centres'
    )
    FROM public.institutes i
    LEFT JOIN public.subscriptions s ON s.owner_id = i.owner_id
    JOIN LATERAL (
      SELECT COUNT(*) AS n FROM public.students st
      WHERE st.owner_id = i.owner_id AND st.status IS DISTINCT FROM 'archived'
    ) cnt ON true
    WHERE cnt.n > public.plan_student_limit(COALESCE(s.plan, 'free'::public.plan_code))
      AND NOT public.has_role(i.owner_id, 'admin')

    UNION ALL

    SELECT jsonb_build_object(
      'kind', 'expiring',
      'severity', CASE WHEN s.expiry_date <= now() + interval '7 days' THEN 'danger' ELSE 'warning' END,
      'title', CASE WHEN s.status = 'trialing' THEN 'Trial ending' ELSE 'Plan expiring' END,
      'detail', s.expiry_date::text,
      'owner_id', i.owner_id,
      'name', i.name,
      'href', '/admin/centres'
    )
    FROM public.institutes i
    JOIN public.subscriptions s ON s.owner_id = i.owner_id
    WHERE s.expiry_date IS NOT NULL
      AND s.expiry_date <= now() + interval '30 days'
      AND NOT public.has_role(i.owner_id, 'admin')

    UNION ALL

    SELECT jsonb_build_object(
      'kind', 'past_due',
      'severity', 'danger',
      'title', 'Past due',
      'detail', s.status,
      'owner_id', i.owner_id,
      'name', i.name,
      'href', '/admin/centres'
    )
    FROM public.institutes i
    JOIN public.subscriptions s ON s.owner_id = i.owner_id
    WHERE s.status = 'past_due'
      AND NOT public.has_role(i.owner_id, 'admin')

    UNION ALL

    SELECT jsonb_build_object(
      'kind', 'unconfirmed',
      'severity', 'info',
      'title', 'Email unconfirmed',
      'detail', u.email::text,
      'owner_id', u.id,
      'name', COALESCE(i.name, u.email::text),
      'href', '/admin/users'
    )
    FROM auth.users u
    LEFT JOIN public.institutes i ON i.owner_id = u.id
    WHERE u.email_confirmed_at IS NULL
      AND u.created_at < now() - interval '1 day'
      AND NOT public.has_role(u.id, 'admin')

    UNION ALL

    SELECT jsonb_build_object(
      'kind', 'orphan',
      'severity', 'info',
      'title', 'User has no centre',
      'detail', u.email::text,
      'owner_id', u.id,
      'name', u.email::text,
      'href', '/admin/users'
    )
    FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.institutes i WHERE i.owner_id = u.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.user_id = u.id AND wm.owner_id IS DISTINCT FROM u.id
      )
      AND NOT public.has_role(u.id, 'admin')
  ) x;

  RETURN COALESCE(v, '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_alerts() TO service_role;

-- ── legacy centre list (subscriptions health) ──────────────────────
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
    WHERE NOT public.has_role(i.owner_id, 'admin')
      AND (
        _search IS NULL
        OR i.name ILIKE '%'||_search||'%'
        OR i.contact_email ILIKE '%'||_search||'%'
      )
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
