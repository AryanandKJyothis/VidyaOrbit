-- Phase A.2 — harden overdue fee WhatsApp (assisted send).
-- Reuses A1 `message_outbox` (kind = fee_overdue). Staff tap "Remind overdue"
-- on Fees; the API inserts one row per overdue student. Deduped one per
-- student per N IST days (default 3, configurable).
--
-- No UPI / pay link in the body (Phase B). wa_auto stays off.
-- There is no extra cron. Assisted wa.me is the send path via mark-sent.
--
-- DO NOT apply this from the agent. An operator applies it. Do not apply to prod
-- from this change.

-- ---------------------------------------------------------------------------
-- Configurable reminder window. Default 3 days. Owners can change in Settings.
-- ---------------------------------------------------------------------------
ALTER TABLE public.institute_messaging_settings
  ADD COLUMN IF NOT EXISTS fee_overdue_dedupe_days integer NOT NULL DEFAULT 3;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'institute_messaging_settings_overdue_days_chk'
  ) THEN
    ALTER TABLE public.institute_messaging_settings
      ADD CONSTRAINT institute_messaging_settings_overdue_days_chk
      CHECK (fee_overdue_dedupe_days BETWEEN 1 AND 30);
  END IF;
END
$$;

COMMENT ON COLUMN public.institute_messaging_settings.fee_overdue_dedupe_days IS
  'One fee_overdue outbox row per student inside this many IST days. Default 3.';

COMMENT ON COLUMN public.message_outbox.dedupe_key IS
  'Absence: absence:<session_id>:<student_id>. Fee paid: fee_paid:<payment_id>. Fee overdue: fee_overdue:<student_id>:<YYYY-MM-DD>. Window enforced in the enqueue API.';

CREATE INDEX IF NOT EXISTS message_outbox_fee_overdue_student_idx
  ON public.message_outbox (owner_id, student_id, created_at DESC)
  WHERE kind = 'fee_overdue';

-- Clients still cannot write the outbox. Enqueue is service_role via the API.
REVOKE ALL ON TABLE public.message_outbox FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.message_outbox TO authenticated;
GRANT ALL ON TABLE public.message_outbox TO service_role;
