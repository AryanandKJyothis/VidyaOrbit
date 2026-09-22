
REVOKE SELECT (admin_notes), UPDATE (admin_notes), INSERT (admin_notes) ON public.institutes FROM authenticated, anon;
GRANT SELECT (admin_notes), UPDATE (admin_notes), INSERT (admin_notes) ON public.institutes TO service_role;
