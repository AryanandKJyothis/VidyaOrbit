-- current_plan is SECURITY DEFINER and was executable by any signed-in user
-- for any owner id. Restrict it to the owner, a member of that workspace, or
-- the service role. Triggers and subscription_health call it with the
-- institute owner id, so workspace members must still be allowed.

CREATE OR REPLACE FUNCTION public.current_plan(_uid uuid)
RETURNS public.plan_code
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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

  RETURN COALESCE(
    (
      SELECT CASE
        WHEN status NOT IN ('active', 'trialing') THEN 'free'::public.plan_code
        WHEN expiry_date IS NOT NULL AND expiry_date < now() THEN 'free'::public.plan_code
        ELSE plan
      END
      FROM public.subscriptions
      WHERE owner_id = _uid
      LIMIT 1
    ),
    'free'::public.plan_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.current_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_plan(uuid) TO authenticated, service_role;
