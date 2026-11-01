-- Nov 1 2026 pricing — step 2 of 2. NOT YET APPLIED. Review before running.
-- Additive / CREATE OR REPLACE only: no tables, columns or rows are dropped.
--
-- !! BEHAVIOUR CHANGE — FLAG BEFORE APPLYING !!
-- New caps: free 25 (unchanged), starter/Spark 50 (was 100), growth/Orbit 150
-- (was 500), pro/Centre 400 (was unlimited), campus unlimited.
-- enforce_student_limit blocks NEW adds above the cap; existing students are
-- never deleted. Before applying, check for paying centres already above the
-- new cap (query at the bottom) and move them up (e.g. pro → campus) or
-- grandfather them (done by 20261101090200_..._grandfather_caps.sql), otherwise they can no longer add students.
--
-- Not covered here (follow-up if Campus becomes self-serve checkout):
-- billing_orders_tier_check and activate RPC tier→plan CASE (only know
-- starter/growth/large). Campus is admin-assigned until then.

CREATE OR REPLACE FUNCTION public.plan_student_limit(_plan public.plan_code)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plan
    WHEN 'free' THEN 25
    WHEN 'starter' THEN 50
    WHEN 'growth' THEN 150
    WHEN 'pro' THEN 400
    WHEN 'campus' THEN 2147483647
  END;
$$;

-- admin_platform_overview: Nov 1 2026 list prices (yearly = 10 months).
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
                WHEN 'starter' THEN round(499000::numeric / 12)
                WHEN 'growth' THEN round(999000::numeric / 12)
                WHEN 'pro' THEN round(1499000::numeric / 12)
                WHEN 'campus' THEN round(2499000::numeric / 12)
                ELSE 0
              END
            ELSE
              CASE COALESCE(s.plan, 'free'::public.plan_code)
                WHEN 'starter' THEN 49900
                WHEN 'growth' THEN 99900
                WHEN 'pro' THEN 149900
                WHEN 'campus' THEN 249900
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

-- Pre-flight check (run manually, read-only): centres above the new caps.
-- SELECT s.owner_id, s.plan, COUNT(st.id) AS active_students,
--        public.plan_student_limit(s.plan) AS new_cap
--   FROM public.subscriptions s
--   JOIN public.students st ON st.owner_id = s.owner_id
--        AND st.status IS DISTINCT FROM 'archived'
--  GROUP BY s.owner_id, s.plan
-- HAVING COUNT(st.id) > public.plan_student_limit(s.plan);
