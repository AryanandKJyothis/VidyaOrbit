-- Shareable receipt and monthly report-card links.
-- Public pages look these up by unguessable token via SECURITY DEFINER RPCs.
-- Do NOT apply this from the agent. An operator applies it. Do not apply to prod
-- from this change.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Token helper: 24 random bytes (192 bits) as lowercase hex. Never a sequential
-- id. Clients cannot call this; only triggers and share RPCs use it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 24 bytes = 192 bits. Fallback concatenates two UUID v4 values (~244 bits)
  -- when pgcrypto's gen_random_bytes is unavailable (local test DBs).
  RETURN encode(gen_random_bytes(24), 'hex');
EXCEPTION
  WHEN undefined_function THEN
    RETURN replace(gen_random_uuid()::text, '-', '')
        || replace(gen_random_uuid()::text, '-', '');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_share_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_share_token() TO service_role;

-- ---------------------------------------------------------------------------
-- receipt_shares: one public link per fee payment
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipt_shares (
  payment_id uuid PRIMARY KEY REFERENCES public.fee_payments(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  share_token text NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receipt_shares_token_len CHECK (char_length(share_token) >= 32)
);

CREATE UNIQUE INDEX IF NOT EXISTS receipt_shares_token_uidx
  ON public.receipt_shares (share_token);

CREATE INDEX IF NOT EXISTS receipt_shares_owner_idx
  ON public.receipt_shares (owner_id);

ALTER TABLE public.receipt_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receipt_shares_select ON public.receipt_shares;
CREATE POLICY receipt_shares_select ON public.receipt_shares
  FOR SELECT
  USING (public.has_resource_access(owner_id, auth.uid(), 'fees', false));

-- No client INSERT/UPDATE/DELETE — issue/revoke/regenerate RPCs write as DEFINER.
REVOKE ALL ON TABLE public.receipt_shares FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.receipt_shares TO authenticated;
GRANT ALL ON TABLE public.receipt_shares TO service_role;

CREATE OR REPLACE FUNCTION public.create_receipt_share_for_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.receipt_shares (payment_id, owner_id, share_token)
  VALUES (NEW.id, NEW.owner_id, public.generate_share_token())
  ON CONFLICT (payment_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_receipt_share_after_insert ON public.fee_payments;
CREATE TRIGGER trg_receipt_share_after_insert
  AFTER INSERT ON public.fee_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_receipt_share_for_payment();

REVOKE ALL ON FUNCTION public.create_receipt_share_for_payment() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- report_shares: one public link per student per month
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  report_month date NOT NULL,
  teacher_remark text,
  share_token text NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_shares_token_len CHECK (char_length(share_token) >= 32),
  CONSTRAINT report_shares_month_first CHECK (date_trunc('month', report_month)::date = report_month),
  CONSTRAINT report_shares_remark_len CHECK (
    teacher_remark IS NULL OR char_length(teacher_remark) <= 500
  ),
  CONSTRAINT report_shares_student_month UNIQUE (owner_id, student_id, report_month)
);

CREATE UNIQUE INDEX IF NOT EXISTS report_shares_token_uidx
  ON public.report_shares (share_token);

CREATE INDEX IF NOT EXISTS report_shares_owner_month_idx
  ON public.report_shares (owner_id, report_month);

ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_shares_select ON public.report_shares;
CREATE POLICY report_shares_select ON public.report_shares
  FOR SELECT
  USING (public.has_resource_access(owner_id, auth.uid(), 'students', false));

REVOKE ALL ON TABLE public.report_shares FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.report_shares TO authenticated;
GRANT ALL ON TABLE public.report_shares TO service_role;

-- ---------------------------------------------------------------------------
-- Public lookup: receipt. GRANT EXECUTE to anon; no table SELECT for anon.
-- Returns only receipt fields. Never phones, never other students.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_receipt(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  IF _token IS NULL OR char_length(_token) < 20 OR char_length(_token) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT
    i.name AS centre_name,
    fp.receipt_number,
    s.full_name AS student_name,
    fp.amount,
    fp.payment_date,
    to_char(fp.payment_date, 'FMMonth YYYY') AS period,
    fp.method AS payment_mode,
    rs.revoked_at
  INTO rec
  FROM public.receipt_shares rs
  JOIN public.fee_payments fp ON fp.id = rs.payment_id
  JOIN public.students s ON s.id = fp.student_id
  JOIN public.institutes i ON i.owner_id = fp.owner_id
  WHERE rs.share_token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF rec.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'centre_name', rec.centre_name,
    'receipt_number', rec.receipt_number,
    'student_name', rec.student_name,
    'amount', rec.amount,
    'payment_date', rec.payment_date,
    'period', rec.period,
    'payment_mode', rec.payment_mode,
    'status', 'Paid'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_receipt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_receipt(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public lookup: monthly report card. Same token pattern.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_report(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  month_start date;
  month_end date;
  days_present int;
  days_absent int;
  marked int;
  paid_in_month numeric;
  monthly_fee numeric;
  due_amount numeric;
BEGIN
  IF _token IS NULL OR char_length(_token) < 20 OR char_length(_token) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT
    rs.revoked_at,
    rs.teacher_remark,
    rs.report_month,
    s.full_name AS student_name,
    s.fee_total,
    s.id AS student_id,
    i.name AS centre_name,
    b.name AS batch_name
  INTO rec
  FROM public.report_shares rs
  JOIN public.students s ON s.id = rs.student_id
  JOIN public.institutes i ON i.owner_id = rs.owner_id
  LEFT JOIN public.batches b ON b.id = s.batch_id
  WHERE rs.share_token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF rec.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;

  month_start := rec.report_month;
  month_end := (date_trunc('month', rec.report_month) + interval '1 month - 1 day')::date;

  SELECT
    COUNT(*) FILTER (WHERE ar.status IN ('present', 'late')),
    COUNT(*) FILTER (WHERE ar.status = 'absent')
  INTO days_present, days_absent
  FROM public.attendance_records ar
  JOIN public.attendance_sessions sess ON sess.id = ar.session_id
  WHERE ar.student_id = rec.student_id
    AND sess.session_date >= month_start
    AND sess.session_date <= month_end;

  marked := COALESCE(days_present, 0) + COALESCE(days_absent, 0);

  SELECT COALESCE(SUM(fp.amount), 0)
  INTO paid_in_month
  FROM public.fee_payments fp
  WHERE fp.student_id = rec.student_id
    AND fp.payment_date >= month_start
    AND fp.payment_date <= month_end;

  monthly_fee := COALESCE(rec.fee_total, 0);
  due_amount := GREATEST(0, monthly_fee - paid_in_month);

  RETURN jsonb_build_object(
    'ok', true,
    'centre_name', rec.centre_name,
    'student_name', rec.student_name,
    'batch_name', rec.batch_name,
    'month', to_char(month_start, 'FMMonth YYYY'),
    'report_month', month_start,
    'attendance_percent', CASE WHEN marked = 0 THEN 0 ELSE ROUND((days_present::numeric / marked) * 100) END,
    'days_present', COALESCE(days_present, 0),
    'days_absent', COALESCE(days_absent, 0),
    'fee_status', CASE WHEN due_amount <= 0 THEN 'paid' ELSE 'due' END,
    'fee_paid_amount', paid_in_month,
    'fee_due_amount', due_amount,
    'teacher_remark', rec.teacher_remark
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_report(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_report(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Authenticated share management (fees write for receipts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_receipt_share(_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay public.fee_payments;
  share public.receipt_shares;
BEGIN
  SELECT * INTO pay FROM public.fee_payments WHERE id = _payment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.has_resource_access(pay.owner_id, auth.uid(), 'fees', true) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.receipt_shares (payment_id, owner_id, share_token)
  VALUES (pay.id, pay.owner_id, public.generate_share_token())
  ON CONFLICT (payment_id) DO UPDATE
    SET updated_at = now()
  RETURNING * INTO share;

  IF share.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'token', share.share_token,
      'revoked', true
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'token', share.share_token,
    'revoked', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_receipt_share(_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay public.fee_payments;
BEGIN
  SELECT * INTO pay FROM public.fee_payments WHERE id = _payment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.has_resource_access(pay.owner_id, auth.uid(), 'fees', true) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.receipt_shares
  SET revoked_at = COALESCE(revoked_at, now()), updated_at = now()
  WHERE payment_id = _payment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'revoked', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_receipt_share(_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay public.fee_payments;
  token text;
BEGIN
  SELECT * INTO pay FROM public.fee_payments WHERE id = _payment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.has_resource_access(pay.owner_id, auth.uid(), 'fees', true) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  token := public.generate_share_token();
  INSERT INTO public.receipt_shares (payment_id, owner_id, share_token, revoked_at)
  VALUES (pay.id, pay.owner_id, token, NULL)
  ON CONFLICT (payment_id) DO UPDATE
    SET share_token = EXCLUDED.share_token,
        revoked_at = NULL,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'token', token, 'revoked', false);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_receipt_share(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_receipt_share(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.regenerate_receipt_share(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_receipt_share(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_receipt_share(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.regenerate_receipt_share(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Authenticated report-share management
-- Read: students:read. Write remark / issue / revoke: attendance:write
-- (staff mark the register and send the card; they cannot edit student rows).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_report_share(
  _student_id uuid,
  _report_month date,
  _teacher_remark text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stu public.students;
  month_start date;
  remark text;
  share public.report_shares;
  can_write boolean;
BEGIN
  SELECT * INTO stu FROM public.students WHERE id = _student_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.has_resource_access(stu.owner_id, auth.uid(), 'students', false) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_resource_access(stu.owner_id, auth.uid(), 'attendance', false) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  can_write := public.has_resource_access(stu.owner_id, auth.uid(), 'attendance', true);
  month_start := date_trunc('month', _report_month)::date;
  remark := NULLIF(btrim(COALESCE(_teacher_remark, '')), '');
  IF remark IS NOT NULL AND char_length(remark) > 500 THEN
    remark := left(remark, 500);
  END IF;

  INSERT INTO public.report_shares (
    owner_id, student_id, report_month, teacher_remark, share_token
  )
  VALUES (
    stu.owner_id,
    stu.id,
    month_start,
    CASE WHEN can_write THEN remark ELSE NULL END,
    public.generate_share_token()
  )
  ON CONFLICT (owner_id, student_id, report_month) DO UPDATE
    SET teacher_remark = CASE
          WHEN can_write AND remark IS NOT NULL THEN remark
          ELSE public.report_shares.teacher_remark
        END,
        updated_at = now()
  RETURNING * INTO share;

  RETURN jsonb_build_object(
    'ok', true,
    'token', share.share_token,
    'revoked', share.revoked_at IS NOT NULL,
    'teacher_remark', share.teacher_remark,
    'report_month', share.report_month
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_report_share(_student_id uuid, _report_month date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stu public.students;
  month_start date;
BEGIN
  SELECT * INTO stu FROM public.students WHERE id = _student_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.has_resource_access(stu.owner_id, auth.uid(), 'attendance', true) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  month_start := date_trunc('month', _report_month)::date;
  UPDATE public.report_shares
  SET revoked_at = COALESCE(revoked_at, now()), updated_at = now()
  WHERE owner_id = stu.owner_id
    AND student_id = _student_id
    AND report_month = month_start;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'revoked', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_report_share(_student_id uuid, _report_month date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stu public.students;
  month_start date;
  token text;
BEGIN
  SELECT * INTO stu FROM public.students WHERE id = _student_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.has_resource_access(stu.owner_id, auth.uid(), 'attendance', true) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  month_start := date_trunc('month', _report_month)::date;
  token := public.generate_share_token();

  INSERT INTO public.report_shares (
    owner_id, student_id, report_month, share_token, revoked_at
  )
  VALUES (stu.owner_id, stu.id, month_start, token, NULL)
  ON CONFLICT (owner_id, student_id, report_month) DO UPDATE
    SET share_token = EXCLUDED.share_token,
        revoked_at = NULL,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'token', token, 'revoked', false);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_report_share(uuid, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_report_share(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.regenerate_report_share(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_report_share(uuid, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_report_share(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.regenerate_report_share(uuid, date) TO authenticated, service_role;
