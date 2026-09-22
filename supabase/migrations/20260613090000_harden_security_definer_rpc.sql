-- Harden SECURITY DEFINER helpers so authenticated users cannot query or mutate
-- another tenant's subscription/workspace state by calling RPCs directly.

-- The manual subscription mutator must only be callable through trusted server
-- code using service_role after application-level admin checks.
REVOKE ALL ON FUNCTION public.apply_subscription_change(
  uuid,
  uuid,
  public.plan_code,
  text,
  timestamptz,
  timestamptz,
  numeric,
  text,
  text,
  boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_change(
  uuid,
  uuid,
  public.plan_code,
  text,
  timestamptz,
  timestamptz,
  numeric,
  text,
  text,
  boolean
) TO service_role;

-- Internal plan lookup is used by triggers and other trusted helpers. Do not
-- expose it as a client-callable oracle for arbitrary owner ids.
REVOKE ALL ON FUNCTION public.current_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_plan(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.workspace_seed_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_student_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_owner uuid, _uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND _uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE owner_id = _owner AND user_id = _uid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.member_permission(_owner uuid, _uid uuid, _resource text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND _uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(
    (
      SELECT permissions->>_resource
      FROM public.workspace_members
      WHERE owner_id = _owner AND user_id = _uid
    ),
    'none'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_resource_access(
  _owner uuid,
  _uid uuid,
  _resource text,
  _write boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permission text;
BEGIN
  IF auth.role() <> 'service_role' AND _uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF _owner = _uid THEN
    RETURN true;
  END IF;

  SELECT permissions->>_resource
    INTO v_permission
    FROM public.workspace_members
    WHERE owner_id = _owner AND user_id = _uid;

  IF _write THEN
    RETURN COALESCE(v_permission, 'none') = 'write';
  END IF;

  RETURN COALESCE(v_permission, 'none') IN ('read', 'write');
END;
$$;

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

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.member_permission(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_resource_access(uuid, uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.subscription_health(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.member_permission(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_resource_access(uuid, uuid, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.subscription_health(uuid) TO authenticated, service_role;
