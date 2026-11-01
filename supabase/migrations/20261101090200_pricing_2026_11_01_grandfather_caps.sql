-- Nov 1 2026 pricing — step 3: grandfather existing centres. NOT YET APPLIED.
-- Run AFTER 20261101090100_pricing_2026_11_01_plan_caps.sql, in the same
-- deploy window. Additive only: new nullable columns, new functions, and
-- CREATE OR REPLACE of enforce_student_limit + subscription_health. No rows
-- are deleted and no plan is changed.
--
-- Rule: a centre whose active (non-archived) student count is already above
-- the NEW cap of its current paid plan keeps its OLD cap (Spark 100, Orbit
-- 500, Centre unlimited) for as long as it stays on that plan. An upgrade
-- gets max(plan cap, override); expiry / drop to free falls back to the free
-- cap (the override is tied to grandfathered_plan). No forced downgrade.
--
-- Rollback (re-blocks over-cap centres on NEW adds only, deletes nothing):
--   UPDATE public.subscriptions SET student_cap_override = NULL, grandfathered_plan = NULL;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS student_cap_override integer
    CHECK (student_cap_override IS NULL OR student_cap_override > 0),
  ADD COLUMN IF NOT EXISTS grandfathered_plan public.plan_code,
  ADD COLUMN IF NOT EXISTS grandfathered_at timestamptz;

COMMENT ON COLUMN public.subscriptions.student_cap_override IS
  'Grandfathered student cap (Nov 1 2026 caps). Applies only while current_plan = grandfathered_plan. NULL = plan_student_limit.';

-- Pre Nov 1 2026 caps; only used to seed grandfathered overrides.
CREATE OR REPLACE FUNCTION public.legacy_plan_student_limit(_plan public.plan_code)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plan::text
    WHEN 'free' THEN 25
    WHEN 'starter' THEN 100
    WHEN 'growth' THEN 500
    ELSE 2147483647
  END;
$$;

CREATE OR REPLACE FUNCTION public.effective_student_limit(_owner uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.plan_code;
  v_limit integer;
  v_override integer;
  v_gf_plan public.plan_code;
BEGIN
  v_plan := public.current_plan(_owner);
  v_limit := public.plan_student_limit(v_plan);
  SELECT s.student_cap_override, s.grandfathered_plan
    INTO v_override, v_gf_plan
    FROM public.subscriptions s WHERE s.owner_id = _owner LIMIT 1;
  IF v_override IS NOT NULL AND v_gf_plan IS NOT DISTINCT FROM v_plan THEN
    RETURN GREATEST(v_limit, v_override);
  END IF;
  RETURN v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.effective_student_limit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_student_limit(uuid) TO service_role;

-- Seed: only centres currently above the new cap of their current plan.
-- Idempotent: never overwrites an existing override.
UPDATE public.subscriptions s
   SET student_cap_override = public.legacy_plan_student_limit(s.plan),
       grandfathered_plan = s.plan,
       grandfathered_at = now()
  FROM (
    SELECT st.owner_id, COUNT(*) AS n
      FROM public.students st
     WHERE st.status IS DISTINCT FROM 'archived'
     GROUP BY st.owner_id
  ) c
 WHERE c.owner_id = s.owner_id
   AND s.student_cap_override IS NULL
   AND s.plan::text IN ('starter', 'growth', 'pro')
   AND c.n > public.plan_student_limit(s.plan);

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
  v_limit := public.effective_student_limit(NEW.owner_id);

  SELECT COUNT(*) INTO v_count
  FROM public.students
  WHERE owner_id = NEW.owner_id
    AND status IS DISTINCT FROM 'archived';

  IF v_count >= v_limit THEN
    v_plan_label := CASE v_plan::text
      WHEN 'starter' THEN 'Spark'
      WHEN 'growth' THEN 'Orbit'
      WHEN 'pro' THEN 'Centre'
      ELSE initcap(v_plan::text)
    END;
    RAISE EXCEPTION 'USER: You''ve reached your % plan limit of % students. Upgrade your plan to add more.', v_plan_label, v_limit;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_student_limit() IS
  'BEFORE INSERT ONLY on public.students. Uses effective_student_limit (plan cap, or grandfathered override while on the same plan). Excludes archived students. Never touches existing rows. Do NOT extend to UPDATE/DELETE.';

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

  SELECT plan, status, start_date, expiry_date, plan_price, notes,
         current_period_end, setup_fee_paid
    INTO v_sub
    FROM public.subscriptions
    WHERE owner_id = _uid
    LIMIT 1;

  v_effective_plan := public.current_plan(_uid);
  v_limit := public.effective_student_limit(_uid);

  SELECT COUNT(*) INTO v_count
    FROM public.students
   WHERE owner_id = _uid
     AND status IS DISTINCT FROM 'archived';

  v_expired := v_sub.expiry_date IS NOT NULL AND v_sub.expiry_date < now();
  v_days_left := CASE
    WHEN v_sub.expiry_date IS NULL THEN NULL
    ELSE EXTRACT(DAY FROM (v_sub.expiry_date - now()))::int
  END;

  v_setup_paid :=
    COALESCE(v_sub.setup_fee_paid, false)
    OR EXISTS (
      SELECT 1 FROM public.billing_orders bo
       WHERE bo.owner_id = _uid
         AND bo.activated_at IS NOT NULL
         AND bo.key_mode = 'live'
    );

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
