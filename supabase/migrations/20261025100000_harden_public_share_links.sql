-- Phase A.7 — harden public /r/<token> receipts (and /report/<token> on the
-- same lookup path): 180-day expiry, IP+token rate limit, append-only access
-- log, workspace aggregates. Public JSON stay on the existing allowlist.
--
-- Rate limit (enforced in get_public_receipt / get_public_report so a direct
-- PostgREST call cannot skip it; an extra Vercel/edge limiter is optional):
--   60 lookups / 60s / IP (soft)
--   20 lookups / 10s / IP (burst)
--   60 lookups / 60s / IP+token
-- Over limit returns {ok:false, reason:'unavailable'} for every token.
-- Expired shares return the same payload as not_found (logged as expired).
--
-- DO NOT apply this from the agent. An operator applies it. Do not apply to prod
-- from this change.

-- ---------------------------------------------------------------------------
-- expires_at: 180 days from issue. Regenerating the token resets the clock.
-- ---------------------------------------------------------------------------
ALTER TABLE public.receipt_shares
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.receipt_shares
SET expires_at = created_at + interval '180 days'
WHERE expires_at IS NULL;

ALTER TABLE public.receipt_shares
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '180 days');

ALTER TABLE public.receipt_shares
  ALTER COLUMN expires_at SET NOT NULL;

ALTER TABLE public.report_shares
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.report_shares
SET expires_at = created_at + interval '180 days'
WHERE expires_at IS NULL;

ALTER TABLE public.report_shares
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '180 days');

ALTER TABLE public.report_shares
  ALTER COLUMN expires_at SET NOT NULL;

COMMENT ON COLUMN public.receipt_shares.expires_at IS
  'Public receipt link dies at this instant. Default 180 days from issue; regenerate resets it. Expired lookups look like not_found.';

COMMENT ON COLUMN public.report_shares.expires_at IS
  'Public report link dies at this instant. Default 180 days from issue; regenerate resets it. Expired lookups look like not_found.';

-- ---------------------------------------------------------------------------
-- Hash helper. SHA-256 when pgcrypto is present; md5 fallback for local
-- PGlite. Never store the raw token, IP, or user-agent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.share_access_hash(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN encode(
    digest(convert_to(COALESCE(raw, '') || ':vo-share-v1', 'UTF8'), 'sha256'),
    'hex'
  );
EXCEPTION
  WHEN undefined_function THEN
    RETURN md5(COALESCE(raw, '') || ':vo-share-v1');
END;
$$;

REVOKE ALL ON FUNCTION public.share_access_hash(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_access_hash(text) TO service_role;

CREATE OR REPLACE FUNCTION public.public_share_request_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  raw text;
  headers json;
BEGIN
  raw := current_setting('request.headers', true);
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN 'unknown';
  END IF;
  BEGIN
    headers := raw::json;
  EXCEPTION
    WHEN others THEN
      RETURN 'unknown';
  END;
  -- Prefer platform-set headers. User-controlled X-Forwarded-For is last.
  RETURN COALESCE(
    NULLIF(btrim(headers->>'x-real-ip'), ''),
    NULLIF(btrim(split_part(COALESCE(headers->>'x-vercel-forwarded-for', ''), ',', 1)), ''),
    NULLIF(btrim(headers->>'cf-connecting-ip'), ''),
    NULLIF(btrim(headers->>'true-client-ip'), ''),
    NULLIF(btrim(split_part(COALESCE(headers->>'x-forwarded-for', ''), ',', 1)), ''),
    'unknown'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.public_share_request_ua()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  raw text;
  headers json;
BEGIN
  raw := current_setting('request.headers', true);
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN 'unknown';
  END IF;
  BEGIN
    headers := raw::json;
  EXCEPTION
    WHEN others THEN
      RETURN 'unknown';
  END;
  RETURN COALESCE(NULLIF(btrim(headers->>'user-agent'), ''), 'unknown');
END;
$$;

REVOKE ALL ON FUNCTION public.public_share_request_ip() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_share_request_ua() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_share_request_ip() TO service_role;
GRANT EXECUTE ON FUNCTION public.public_share_request_ua() TO service_role;

-- ---------------------------------------------------------------------------
-- Rate-limit buckets. service_role / DEFINER only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.public_share_rate_buckets (
  ip_hash text NOT NULL,
  token_hash text NOT NULL DEFAULT '',
  window_kind text NOT NULL,
  window_start timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 1,
  CONSTRAINT public_share_rate_buckets_kind CHECK (window_kind IN ('minute', 'burst')),
  CONSTRAINT public_share_rate_buckets_hits CHECK (hit_count >= 0),
  PRIMARY KEY (ip_hash, token_hash, window_kind, window_start)
);

ALTER TABLE public.public_share_rate_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_share_rate_buckets FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.public_share_rate_buckets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.public_share_rate_buckets TO service_role;

CREATE OR REPLACE FUNCTION public.public_share_rate_allow(_ip_hash text, _token_hash text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minute timestamptz;
  v_burst timestamptz;
  v_ip_min int;
  v_ip_burst int;
  v_tok_min int;
BEGIN
  -- 60/min/IP soft + 20/10s burst + 60/min/IP+token. See file header.
  v_minute := date_trunc('minute', clock_timestamp());
  v_burst := to_timestamp(floor(extract(epoch FROM clock_timestamp()) / 10) * 10);

  DELETE FROM public.public_share_rate_buckets
  WHERE window_start < clock_timestamp() - interval '2 minutes';

  INSERT INTO public.public_share_rate_buckets (
    ip_hash, token_hash, window_kind, window_start, hit_count
  )
  VALUES (_ip_hash, '', 'minute', v_minute, 1)
  ON CONFLICT (ip_hash, token_hash, window_kind, window_start)
  DO UPDATE SET hit_count = public.public_share_rate_buckets.hit_count + 1
  RETURNING hit_count INTO v_ip_min;

  INSERT INTO public.public_share_rate_buckets (
    ip_hash, token_hash, window_kind, window_start, hit_count
  )
  VALUES (_ip_hash, '', 'burst', v_burst, 1)
  ON CONFLICT (ip_hash, token_hash, window_kind, window_start)
  DO UPDATE SET hit_count = public.public_share_rate_buckets.hit_count + 1
  RETURNING hit_count INTO v_ip_burst;

  INSERT INTO public.public_share_rate_buckets (
    ip_hash, token_hash, window_kind, window_start, hit_count
  )
  VALUES (_ip_hash, COALESCE(_token_hash, ''), 'minute', v_minute, 1)
  ON CONFLICT (ip_hash, token_hash, window_kind, window_start)
  DO UPDATE SET hit_count = public.public_share_rate_buckets.hit_count + 1
  RETURNING hit_count INTO v_tok_min;

  IF v_ip_min > 60 OR v_ip_burst > 20 OR v_tok_min > 60 THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.public_share_rate_allow(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_share_rate_allow(text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Append-only access log. Raw rows are service_role only. Retention ≥ 90 days.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.public_share_access_log (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid,
  share_kind text NOT NULL,
  token_hash text NOT NULL,
  result text NOT NULL,
  ip_hash text NOT NULL,
  ua_hash text NOT NULL,
  CONSTRAINT public_share_access_log_kind CHECK (share_kind IN ('receipt', 'report')),
  CONSTRAINT public_share_access_log_result CHECK (
    result IN ('ok', 'not_found', 'revoked', 'expired', 'rate_limited')
  )
);

CREATE INDEX IF NOT EXISTS public_share_access_log_owner_created_idx
  ON public.public_share_access_log (owner_id, created_at DESC)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS public_share_access_log_created_idx
  ON public.public_share_access_log (created_at);

COMMENT ON TABLE public.public_share_access_log IS
  'Public share lookups. Stores hashes only. Keep at least 90 days. Raw rows are service_role; workspace fees:read sees aggregates via public_share_access_summary.';

ALTER TABLE public.public_share_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_share_access_log FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.public_share_access_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.public_share_access_log_id_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.public_share_access_log TO service_role;
GRANT ALL ON SEQUENCE public.public_share_access_log_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.protect_public_share_access_log()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'public_share_access_log is append-only';
  END IF;
  IF TG_OP = 'DELETE' AND OLD.created_at > now() - interval '90 days' THEN
    RAISE EXCEPTION 'public_share_access_log rows must be kept for 90 days';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_public_share_access_log_protect ON public.public_share_access_log;
CREATE TRIGGER trg_public_share_access_log_protect
  BEFORE UPDATE OR DELETE ON public.public_share_access_log
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_public_share_access_log();

REVOKE ALL ON FUNCTION public.protect_public_share_access_log() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_public_share_access(
  _owner_id uuid,
  _share_kind text,
  _token_hash text,
  _result text,
  _ip_hash text,
  _ua_hash text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.public_share_access_log (
    owner_id, share_kind, token_hash, result, ip_hash, ua_hash
  )
  VALUES (
    _owner_id,
    _share_kind,
    _token_hash,
    _result,
    _ip_hash,
    _ua_hash
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_public_share_access(uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_public_share_access(uuid, text, text, text, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.purge_public_share_access_log(
  _older_than interval DEFAULT interval '90 days'
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  cutoff interval;
BEGIN
  cutoff := GREATEST(COALESCE(_older_than, interval '90 days'), interval '90 days');
  DELETE FROM public.public_share_access_log
  WHERE created_at <= now() - cutoff;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_public_share_access_log(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_public_share_access_log(interval) TO service_role;

-- Workspace aggregates. Never returns token_hash, ip_hash, or ua_hash.
CREATE OR REPLACE FUNCTION public.public_share_access_summary(
  _owner_id uuid DEFAULT NULL,
  _days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_days int;
  v_receipt jsonb;
  v_report jsonb;
BEGIN
  v_owner := COALESCE(_owner_id, auth.uid());
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_resource_access(v_owner, auth.uid(), 'fees', false) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_days := GREATEST(1, LEAST(COALESCE(_days, 30), 90));

  SELECT jsonb_build_object(
    'ok', COUNT(*) FILTER (WHERE result = 'ok'),
    'not_found', COUNT(*) FILTER (WHERE result = 'not_found'),
    'revoked', COUNT(*) FILTER (WHERE result = 'revoked'),
    'expired', COUNT(*) FILTER (WHERE result = 'expired'),
    'rate_limited', COUNT(*) FILTER (WHERE result = 'rate_limited')
  )
  INTO v_receipt
  FROM public.public_share_access_log
  WHERE owner_id = v_owner
    AND share_kind = 'receipt'
    AND created_at >= now() - (v_days || ' days')::interval;

  SELECT jsonb_build_object(
    'ok', COUNT(*) FILTER (WHERE result = 'ok'),
    'not_found', COUNT(*) FILTER (WHERE result = 'not_found'),
    'revoked', COUNT(*) FILTER (WHERE result = 'revoked'),
    'expired', COUNT(*) FILTER (WHERE result = 'expired'),
    'rate_limited', COUNT(*) FILTER (WHERE result = 'rate_limited')
  )
  INTO v_report
  FROM public.public_share_access_log
  WHERE owner_id = v_owner
    AND share_kind = 'report'
    AND created_at >= now() - (v_days || ' days')::interval;

  RETURN jsonb_build_object(
    'ok', true,
    'days', v_days,
    'receipt', v_receipt,
    'report', v_report
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_share_access_summary(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.public_share_access_summary(uuid, integer)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public lookup: receipt. VOLATILE because it writes the access log / buckets.
-- Returns only the existing allowlist. Expired → not_found. Rate limit →
-- unavailable. Never returns reason 'expired'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_receipt(_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  v_ip_hash text;
  v_ua_hash text;
  v_token_hash text;
  v_owner uuid;
BEGIN
  v_ip_hash := public.share_access_hash(public.public_share_request_ip());
  v_ua_hash := public.share_access_hash(public.public_share_request_ua());
  v_token_hash := public.share_access_hash(COALESCE(_token, ''));

  IF NOT public.public_share_rate_allow(v_ip_hash, v_token_hash) THEN
    IF _token IS NOT NULL AND char_length(_token) >= 20 AND char_length(_token) <= 200 THEN
      SELECT rs.owner_id INTO v_owner
      FROM public.receipt_shares rs
      WHERE rs.share_token = _token;
    END IF;
    PERFORM public.log_public_share_access(
      v_owner, 'receipt', v_token_hash, 'rate_limited', v_ip_hash, v_ua_hash
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'unavailable');
  END IF;

  IF _token IS NULL OR char_length(_token) < 20 OR char_length(_token) > 200 THEN
    PERFORM public.log_public_share_access(
      NULL, 'receipt', v_token_hash, 'not_found', v_ip_hash, v_ua_hash
    );
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
    rs.revoked_at,
    rs.expires_at,
    rs.owner_id AS share_owner
  INTO rec
  FROM public.receipt_shares rs
  JOIN public.fee_payments fp ON fp.id = rs.payment_id
  JOIN public.students s ON s.id = fp.student_id
  JOIN public.institutes i ON i.owner_id = fp.owner_id
  WHERE rs.share_token = _token;

  IF NOT FOUND THEN
    PERFORM public.log_public_share_access(
      NULL, 'receipt', v_token_hash, 'not_found', v_ip_hash, v_ua_hash
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF rec.revoked_at IS NOT NULL THEN
    PERFORM public.log_public_share_access(
      rec.share_owner, 'receipt', v_token_hash, 'revoked', v_ip_hash, v_ua_hash
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;

  IF rec.expires_at IS NOT NULL AND rec.expires_at <= clock_timestamp() THEN
    PERFORM public.log_public_share_access(
      rec.share_owner, 'receipt', v_token_hash, 'expired', v_ip_hash, v_ua_hash
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM public.log_public_share_access(
    rec.share_owner, 'receipt', v_token_hash, 'ok', v_ip_hash, v_ua_hash
  );

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
-- Public lookup: monthly report card. Same expiry / rate-limit / log rules.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_report(_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
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
  v_ip_hash text;
  v_ua_hash text;
  v_token_hash text;
  v_owner uuid;
BEGIN
  v_ip_hash := public.share_access_hash(public.public_share_request_ip());
  v_ua_hash := public.share_access_hash(public.public_share_request_ua());
  v_token_hash := public.share_access_hash(COALESCE(_token, ''));

  IF NOT public.public_share_rate_allow(v_ip_hash, v_token_hash) THEN
    IF _token IS NOT NULL AND char_length(_token) >= 20 AND char_length(_token) <= 200 THEN
      SELECT rs.owner_id INTO v_owner
      FROM public.report_shares rs
      WHERE rs.share_token = _token;
    END IF;
    PERFORM public.log_public_share_access(
      v_owner, 'report', v_token_hash, 'rate_limited', v_ip_hash, v_ua_hash
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'unavailable');
  END IF;

  IF _token IS NULL OR char_length(_token) < 20 OR char_length(_token) > 200 THEN
    PERFORM public.log_public_share_access(
      NULL, 'report', v_token_hash, 'not_found', v_ip_hash, v_ua_hash
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT
    rs.revoked_at,
    rs.expires_at,
    rs.teacher_remark,
    rs.report_month,
    rs.owner_id AS share_owner,
    s.full_name AS student_name,
    s.fee_total,
    s.id AS sid,
    i.name AS centre_name,
    b.name AS batch_name
  INTO rec
  FROM public.report_shares rs
  JOIN public.students s ON s.id = rs.student_id
  JOIN public.institutes i ON i.owner_id = rs.owner_id
  LEFT JOIN public.batches b ON b.id = s.batch_id
  WHERE rs.share_token = _token;

  IF NOT FOUND THEN
    PERFORM public.log_public_share_access(
      NULL, 'report', v_token_hash, 'not_found', v_ip_hash, v_ua_hash
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF rec.revoked_at IS NOT NULL THEN
    PERFORM public.log_public_share_access(
      rec.share_owner, 'report', v_token_hash, 'revoked', v_ip_hash, v_ua_hash
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;

  IF rec.expires_at IS NOT NULL AND rec.expires_at <= clock_timestamp() THEN
    PERFORM public.log_public_share_access(
      rec.share_owner, 'report', v_token_hash, 'expired', v_ip_hash, v_ua_hash
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  month_start := rec.report_month;
  month_end := (date_trunc('month', rec.report_month) + interval '1 month - 1 day')::date;

  SELECT
    COUNT(*) FILTER (WHERE ar.status IN ('present', 'late')),
    COUNT(*) FILTER (WHERE ar.status = 'absent')
  INTO days_present, days_absent
  FROM public.attendance_records ar
  JOIN public.attendance_sessions sess ON sess.id = ar.session_id
  WHERE ar.student_id = rec.sid
    AND sess.session_date >= month_start
    AND sess.session_date <= month_end;

  marked := COALESCE(days_present, 0) + COALESCE(days_absent, 0);

  SELECT COALESCE(SUM(fp.amount), 0)
  INTO paid_in_month
  FROM public.fee_payments fp
  WHERE fp.student_id = rec.sid
    AND fp.payment_date >= month_start
    AND fp.payment_date <= month_end;

  monthly_fee := COALESCE(rec.fee_total, 0);
  due_amount := GREATEST(0, monthly_fee - paid_in_month);

  PERFORM public.log_public_share_access(
    rec.share_owner, 'report', v_token_hash, 'ok', v_ip_hash, v_ua_hash
  );

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
-- regenerate resets expiry. Revoke is unchanged (still works before expiry).
-- ---------------------------------------------------------------------------
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
  INSERT INTO public.receipt_shares (
    payment_id, owner_id, share_token, revoked_at, expires_at
  )
  VALUES (pay.id, pay.owner_id, token, NULL, now() + interval '180 days')
  ON CONFLICT (payment_id) DO UPDATE
    SET share_token = EXCLUDED.share_token,
        revoked_at = NULL,
        expires_at = EXCLUDED.expires_at,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'token', token, 'revoked', false);
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
    owner_id, student_id, report_month, share_token, revoked_at, expires_at
  )
  VALUES (stu.owner_id, stu.id, month_start, token, NULL, now() + interval '180 days')
  ON CONFLICT (owner_id, student_id, report_month) DO UPDATE
    SET share_token = EXCLUDED.share_token,
        revoked_at = NULL,
        expires_at = EXCLUDED.expires_at,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'token', token, 'revoked', false);
END;
$$;

REVOKE ALL ON FUNCTION public.regenerate_receipt_share(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.regenerate_report_share(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_receipt_share(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.regenerate_report_share(uuid, date) TO authenticated, service_role;
