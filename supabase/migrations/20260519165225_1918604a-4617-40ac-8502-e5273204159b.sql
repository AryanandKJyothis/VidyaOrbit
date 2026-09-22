-- Lock down SECURITY DEFINER helpers (only server-side trigger/code uses them)
REVOKE EXECUTE ON FUNCTION public.current_plan(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_student_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.plan_student_limit(public.plan_code) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_receipt_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;