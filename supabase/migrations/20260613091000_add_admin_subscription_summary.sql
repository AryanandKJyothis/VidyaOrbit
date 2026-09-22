-- Service-role-only aggregate used by the admin subscription page.
-- Keeps customer listing scalable by counting students inside Postgres instead
-- of downloading rows and counting them in the app server.

CREATE OR REPLACE FUNCTION public.admin_institute_subscription_summary(_search text DEFAULT NULL)
RETURNS TABLE (
  owner_id uuid,
  name text,
  contact_email text,
  plan public.plan_code,
  status text,
  expiry_date timestamptz,
  plan_price numeric,
  student_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.owner_id,
    i.name,
    i.contact_email,
    s.plan,
    s.status,
    s.expiry_date,
    s.plan_price,
    COUNT(st.id)::bigint AS student_count
  FROM public.institutes i
  LEFT JOIN public.subscriptions s ON s.owner_id = i.owner_id
  LEFT JOIN public.students st ON st.owner_id = i.owner_id
  WHERE
    COALESCE(NULLIF(trim(_search), ''), '') = ''
    OR i.name ILIKE ('%' || trim(_search) || '%')
    OR i.contact_email ILIKE ('%' || trim(_search) || '%')
  GROUP BY
    i.owner_id,
    i.name,
    i.contact_email,
    s.plan,
    s.status,
    s.expiry_date,
    s.plan_price
  ORDER BY i.name
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.admin_institute_subscription_summary(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_institute_subscription_summary(text) TO service_role;
