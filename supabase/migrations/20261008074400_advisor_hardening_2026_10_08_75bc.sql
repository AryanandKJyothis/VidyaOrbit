-- advisor_hardening_2026_10_08
-- 1. member_permission is not referenced by any RLS policy, view, trigger,
--    column default, constraint or other function, and the app never calls it
--    via RPC. Remove it from the exposed API for client roles.
--    (public.has_role(uuid, app_role) intentionally NOT revoked: it is called by
--    admin_institute_health_detail, admin_institute_health_summary and
--    apply_subscription_change.)
REVOKE EXECUTE ON FUNCTION public.member_permission(uuid, uuid, text) FROM authenticated, anon;

-- 2. Cover the two unindexed foreign keys flagged by the performance advisor.
CREATE INDEX IF NOT EXISTS idx_subscription_audit_changed_by
  ON public.subscription_audit (changed_by);
CREATE INDEX IF NOT EXISTS idx_subscriptions_updated_by
  ON public.subscriptions (updated_by);
