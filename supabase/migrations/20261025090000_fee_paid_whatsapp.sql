-- Phase A.3 — fee-paid acknowledgement + public receipt WhatsApp (assisted send).
-- Reuses A1 `message_outbox` (kind = fee_paid). Dedupe is one row per payment_id.
-- Manual mark-paid and any writer that inserts fee_payments (including a future
-- student-fee Razorpay webhook) go through the same trigger. Replay cannot
-- double-queue: UNIQUE (owner_id, dedupe_key) + ON CONFLICT DO NOTHING.
--
-- Public receipt links reuse receipt_shares (unguessable token, no login,
-- revocable). Regenerating the token rewrites a still-queued ack body.
--
-- DO NOT apply this from the agent. An operator applies it. Do not apply to prod
-- from this change.

-- ---------------------------------------------------------------------------
-- Staff with fees:read may see fee_paid drafts. Send stays messages:write
-- (enforced by /api/messaging/mark-sent, not this policy).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS message_outbox_select ON public.message_outbox;
CREATE POLICY message_outbox_select ON public.message_outbox
  FOR SELECT TO authenticated
  USING (
    public.has_resource_access(owner_id, auth.uid(), 'messages', false)
    OR public.has_resource_access(owner_id, auth.uid(), 'attendance', false)
    OR public.has_resource_access(owner_id, auth.uid(), 'fees', false)
  );

COMMENT ON COLUMN public.message_outbox.dedupe_key IS
  'Absence: absence:<session_id>:<student_id>. Fee paid: fee_paid:<payment_id>. One row per payment.';

-- ---------------------------------------------------------------------------
-- Deterministic ₹ grouping so the SQL body matches the TypeScript template.
-- Last 3 digits, then groups of 2 (en-IN). No decimals.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.format_inr_ack(amount numeric)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  n bigint;
  s text;
  grouped text;
  rest text;
  chunk text;
BEGIN
  n := round(COALESCE(amount, 0));
  s := abs(n)::text;
  IF char_length(s) <= 3 THEN
    grouped := s;
  ELSE
    grouped := right(s, 3);
    rest := left(s, char_length(s) - 3);
    WHILE char_length(rest) > 0 LOOP
      chunk := right(rest, LEAST(2, char_length(rest)));
      grouped := chunk || ',' || grouped;
      rest := left(rest, char_length(rest) - char_length(chunk));
    END LOOP;
  END IF;
  RETURN '₹' || CASE WHEN n < 0 THEN '-' ELSE '' END || grouped;
END;
$$;

REVOKE ALL ON FUNCTION public.format_inr_ack(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.format_inr_ack(numeric) TO service_role;

-- Canonical public origin. Must match src/lib/site.ts SITE_URL.
CREATE OR REPLACE FUNCTION public.fee_paid_receipt_url(share_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'https://www.vidyaorbit.in/r/' || share_token;
$$;

REVOKE ALL ON FUNCTION public.fee_paid_receipt_url(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fee_paid_receipt_url(text) TO service_role;

CREATE OR REPLACE FUNCTION public.fee_paid_ack_body(
  amount numeric,
  student_name text,
  payment_date date,
  receipt_number text,
  share_token text,
  balance numeric
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'Payment received: '
    || public.format_inr_ack(amount)
    || ' for '
    || COALESCE(NULLIF(btrim(student_name), ''), 'your child')
    || ' on '
    || to_char(payment_date, 'DD Mon YYYY')
    || '. Receipt '
    || COALESCE(NULLIF(btrim(receipt_number), ''), '—')
    || ': '
    || public.fee_paid_receipt_url(share_token)
    || '. Balance: '
    || public.format_inr_ack(balance)
    || '.';
$$;

REVOKE ALL ON FUNCTION public.fee_paid_ack_body(numeric, text, date, text, text, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fee_paid_ack_body(numeric, text, date, text, text, numeric)
  TO service_role;

-- ---------------------------------------------------------------------------
-- fee_payments INSERT → one fee_paid outbox row. Covers manual record and
-- webhook writers that insert the same table. Dedupe = payment_id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_fee_paid_parent_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student text;
  v_phone text;
  v_token text;
  v_paid numeric;
  v_total numeric;
  v_balance numeric;
  v_key text;
  v_body text;
BEGIN
  v_key := 'fee_paid:' || NEW.id::text;

  INSERT INTO public.receipt_shares (payment_id, owner_id, share_token)
  VALUES (NEW.id, NEW.owner_id, public.generate_share_token())
  ON CONFLICT (payment_id) DO NOTHING;

  SELECT rs.share_token INTO v_token
  FROM public.receipt_shares rs
  WHERE rs.payment_id = NEW.id;

  IF v_token IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.full_name,
         s.fee_total,
         CASE
           WHEN s.guardian_phone IS NOT NULL
            AND right(regexp_replace(s.guardian_phone, '\D', '', 'g'), 10) ~ '^[6-9][0-9]{9}$'
           THEN '+91' || right(regexp_replace(s.guardian_phone, '\D', '', 'g'), 10)
           WHEN s.phone IS NOT NULL
            AND right(regexp_replace(s.phone, '\D', '', 'g'), 10) ~ '^[6-9][0-9]{9}$'
           THEN '+91' || right(regexp_replace(s.phone, '\D', '', 'g'), 10)
           ELSE NULL
         END
    INTO v_student, v_total, v_phone
  FROM public.students s
  WHERE s.id = NEW.student_id
    AND s.owner_id = NEW.owner_id;

  SELECT COALESCE(SUM(fp.amount), 0)
    INTO v_paid
  FROM public.fee_payments fp
  WHERE fp.owner_id = NEW.owner_id
    AND fp.student_id = NEW.student_id;

  v_balance := GREATEST(0, COALESCE(v_total, 0) - COALESCE(v_paid, 0));
  v_body := public.fee_paid_ack_body(
    NEW.amount,
    v_student,
    NEW.payment_date,
    NEW.receipt_number,
    v_token,
    v_balance
  );

  INSERT INTO public.message_outbox (
    owner_id, student_id, session_id, session_date, kind,
    phone, body, status, skip_reason, dedupe_key, created_by, payload
  ) VALUES (
    NEW.owner_id,
    NEW.student_id,
    NULL,
    NEW.payment_date,
    'fee_paid',
    v_phone,
    v_body,
    CASE WHEN v_phone IS NULL THEN 'skipped' ELSE 'queued' END,
    CASE WHEN v_phone IS NULL THEN 'no_phone' ELSE NULL END,
    v_key,
    auth.uid(),
    jsonb_build_object(
      'paymentId', NEW.id::text,
      'studentName', COALESCE(v_student, 'your child'),
      'amount', NEW.amount,
      'paymentDate', NEW.payment_date::text,
      'receiptNumber', NEW.receipt_number,
      'receiptUrl', public.fee_paid_receipt_url(v_token),
      'shareToken', v_token,
      'balance', v_balance,
      'phoneSource', CASE WHEN v_phone IS NULL THEN NULL ELSE 'parent' END
    )
  )
  ON CONFLICT (owner_id, dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_fee_paid_parent_message() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_fee_paid_parent_message() TO service_role;

DROP TRIGGER IF EXISTS trg_fee_paid_parent_message ON public.fee_payments;
CREATE TRIGGER trg_fee_paid_parent_message
  AFTER INSERT ON public.fee_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_fee_paid_parent_message();

-- ---------------------------------------------------------------------------
-- Regenerating a receipt token rewrites a still-queued ack so staff never
-- send a revoked link. Already-sent rows are left alone.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_fee_paid_ack_on_share_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay public.fee_payments;
  v_student text;
  v_paid numeric;
  v_total numeric;
  v_balance numeric;
  v_body text;
BEGIN
  IF NEW.share_token IS NOT DISTINCT FROM OLD.share_token
     AND NEW.revoked_at IS NOT DISTINCT FROM OLD.revoked_at THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_pay FROM public.fee_payments WHERE id = NEW.payment_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT s.full_name, s.fee_total
    INTO v_student, v_total
  FROM public.students s
  WHERE s.id = v_pay.student_id
    AND s.owner_id = v_pay.owner_id;

  SELECT COALESCE(SUM(fp.amount), 0)
    INTO v_paid
  FROM public.fee_payments fp
  WHERE fp.owner_id = v_pay.owner_id
    AND fp.student_id = v_pay.student_id;

  v_balance := GREATEST(0, COALESCE(v_total, 0) - COALESCE(v_paid, 0));
  v_body := public.fee_paid_ack_body(
    v_pay.amount,
    v_student,
    v_pay.payment_date,
    v_pay.receipt_number,
    NEW.share_token,
    v_balance
  );

  UPDATE public.message_outbox
  SET body = v_body,
      payload = COALESCE(payload, '{}'::jsonb)
        || jsonb_build_object(
          'receiptUrl', public.fee_paid_receipt_url(NEW.share_token),
          'shareToken', NEW.share_token,
          'balance', v_balance
        ),
      updated_at = now()
  WHERE owner_id = NEW.owner_id
    AND dedupe_key = 'fee_paid:' || NEW.payment_id::text
    AND status = 'queued';

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_fee_paid_ack_on_share_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_fee_paid_ack_on_share_change() TO service_role;

DROP TRIGGER IF EXISTS trg_fee_paid_ack_on_share_change ON public.receipt_shares;
CREATE TRIGGER trg_fee_paid_ack_on_share_change
  AFTER UPDATE OF share_token, revoked_at ON public.receipt_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_fee_paid_ack_on_share_change();
