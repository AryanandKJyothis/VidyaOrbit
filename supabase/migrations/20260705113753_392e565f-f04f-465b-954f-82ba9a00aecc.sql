DROP FUNCTION IF EXISTS public.admin_institute_health_summary(text);

CREATE OR REPLACE FUNCTION public.admin_institute_health_summary(_search text DEFAULT NULL::text)
 RETURNS TABLE(owner_id uuid, name text, contact_email text, member_emails text[], plan plan_code, status text, start_date timestamp with time zone, expiry_date timestamp with time zone, plan_price numeric, student_count bigint, plan_limit integer, days_until_expiry integer, last_active_at timestamp with time zone, last_active_source text, attendance_30d bigint, payments_30d bigint, students_30d bigint, batches_30d bigint, top_feature_30d text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT i.owner_id, i.name, i.contact_email,
           s.plan, s.status, s.start_date, s.expiry_date, s.plan_price
    FROM public.institutes i
    LEFT JOIN public.subscriptions s ON s.owner_id = i.owner_id
    WHERE _search IS NULL
       OR i.name ILIKE '%'||_search||'%'
       OR i.contact_email ILIKE '%'||_search||'%'
  ),
  members AS (
    SELECT b.owner_id,
      COALESCE(
        array_agg(DISTINCT u.email ORDER BY u.email) FILTER (WHERE u.email IS NOT NULL),
        ARRAY[]::text[]
      ) AS member_emails
    FROM base b
    LEFT JOIN public.workspace_members wm ON wm.owner_id = b.owner_id
    LEFT JOIN auth.users u ON u.id = wm.user_id
    GROUP BY b.owner_id
  ),
  counts AS (
    SELECT b.owner_id,
      (SELECT COUNT(*) FROM public.students st WHERE st.owner_id = b.owner_id) AS student_count,
      (SELECT COUNT(*) FROM public.attendance_sessions a
         WHERE a.owner_id = b.owner_id AND a.created_at > now() - interval '30 days') AS att_30,
      (SELECT COUNT(*) FROM public.fee_payments p
         WHERE p.owner_id = b.owner_id AND p.created_at > now() - interval '30 days') AS pay_30,
      (SELECT COUNT(*) FROM public.students st
         WHERE st.owner_id = b.owner_id AND st.created_at > now() - interval '30 days') AS stu_30,
      (SELECT COUNT(*) FROM public.batches bt
         WHERE bt.owner_id = b.owner_id AND bt.updated_at > now() - interval '30 days') AS bat_30,
      (SELECT MAX(a.created_at) FROM public.attendance_sessions a WHERE a.owner_id = b.owner_id) AS last_att,
      (SELECT MAX(p.created_at) FROM public.fee_payments p WHERE p.owner_id = b.owner_id) AS last_pay,
      (SELECT MAX(st.created_at) FROM public.students st WHERE st.owner_id = b.owner_id) AS last_stu,
      (SELECT MAX(bt.updated_at) FROM public.batches bt WHERE bt.owner_id = b.owner_id) AS last_bat
    FROM base b
  )
  SELECT
    b.owner_id, b.name, b.contact_email, m.member_emails,
    b.plan, b.status, b.start_date, b.expiry_date, b.plan_price,
    c.student_count,
    public.plan_student_limit(COALESCE(b.plan, 'free'::public.plan_code)) AS plan_limit,
    CASE WHEN b.expiry_date IS NULL THEN NULL
         ELSE EXTRACT(DAY FROM (b.expiry_date - now()))::int END AS days_until_expiry,
    GREATEST(
      COALESCE(c.last_att, 'epoch'::timestamptz),
      COALESCE(c.last_pay, 'epoch'::timestamptz),
      COALESCE(c.last_stu, 'epoch'::timestamptz),
      COALESCE(c.last_bat, 'epoch'::timestamptz)
    ) AS last_active_at,
    CASE GREATEST(
      COALESCE(c.last_att, 'epoch'::timestamptz),
      COALESCE(c.last_pay, 'epoch'::timestamptz),
      COALESCE(c.last_stu, 'epoch'::timestamptz),
      COALESCE(c.last_bat, 'epoch'::timestamptz)
    )
      WHEN c.last_att THEN 'Attendance'
      WHEN c.last_pay THEN 'Fees'
      WHEN c.last_stu THEN 'Students'
      WHEN c.last_bat THEN 'Batches'
      ELSE NULL
    END AS last_active_source,
    c.att_30, c.pay_30, c.stu_30, c.bat_30,
    CASE
      WHEN GREATEST(c.att_30, c.pay_30, c.stu_30, c.bat_30) = 0 THEN NULL
      WHEN c.att_30 >= c.pay_30 AND c.att_30 >= c.stu_30 AND c.att_30 >= c.bat_30 THEN 'Attendance'
      WHEN c.pay_30 >= c.stu_30 AND c.pay_30 >= c.bat_30 THEN 'Fees'
      WHEN c.stu_30 >= c.bat_30 THEN 'Students'
      ELSE 'Batches'
    END AS top_feature_30d
  FROM base b
  JOIN counts c ON c.owner_id = b.owner_id
  JOIN members m ON m.owner_id = b.owner_id
  ORDER BY b.name;
END;
$function$;