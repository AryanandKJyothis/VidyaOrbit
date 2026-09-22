
-- Trigger-only functions: no API callers
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_receipt_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_student_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.workspace_seed_owner() FROM PUBLIC, anon, authenticated;

-- Admin/server-only RPCs: only service_role
REVOKE EXECUTE ON FUNCTION public.apply_subscription_change(uuid, uuid, plan_code, text, timestamptz, timestamptz, numeric, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_subscription_change(uuid, uuid, plan_code, text, timestamptz, timestamptz, numeric, text, text, boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_institute_health_summary(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_institute_health_summary(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_institute_health_detail(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_institute_health_detail(uuid) TO service_role;

-- Helpers used by RLS / signed-in app code: revoke from anon + public, allow authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.current_plan(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_plan(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.plan_student_limit(plan_code) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.plan_student_limit(plan_code) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.member_permission(uuid, uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.member_permission(uuid, uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_resource_access(uuid, uuid, text, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_resource_access(uuid, uuid, text, boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.subscription_health(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.subscription_health(uuid) TO authenticated, service_role;
