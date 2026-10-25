-- Phase A.1 — absence → parent WhatsApp (assisted send).
-- Shared `message_outbox` is reused by A2 (fee overdue) and A3 (fee paid).
-- Tier 1: staff tap wa.me from the queue. Tier 2 auto-send is `wa_auto` (off).
--
-- DO NOT apply this from the agent. An operator applies it. Do not apply to prod
-- from this change.

-- ---------------------------------------------------------------------------
-- A5 slice used by A1: `messages` permission on existing members (no access loss)
-- ---------------------------------------------------------------------------
UPDATE public.workspace_members
SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"messages":"write"}'::jsonb
WHERE role IN (
    'owner'::public.workspace_role,
    'manager'::public.workspace_role,
    'staff'::public.workspace_role
  )
  AND COALESCE(permissions->>'messages', '') = '';

UPDATE public.workspace_invites
SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"messages":"write"}'::jsonb
WHERE role IN (
    'owner'::public.workspace_role,
    'manager'::public.workspace_role,
    'staff'::public.workspace_role
  )
  AND status = 'pending'
  AND COALESCE(permissions->>'messages', '') = '';

UPDATE public.workspace_members
SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"messages":"none"}'::jsonb
WHERE role = 'viewer'::public.workspace_role
  AND COALESCE(permissions->>'messages', '') = '';

UPDATE public.workspace_invites
SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"messages":"none"}'::jsonb
WHERE role = 'viewer'::public.workspace_role
  AND status = 'pending'
  AND COALESCE(permissions->>'messages', '') = '';

-- ---------------------------------------------------------------------------
-- Per-centre settings. wa_auto stays false until a verified number + templates.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institute_messaging_settings (
  owner_id uuid PRIMARY KEY,
  wa_auto boolean NOT NULL DEFAULT false,
  locale text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT institute_messaging_settings_locale_chk
    CHECK (locale IN ('en', 'ml'))
);

COMMENT ON TABLE public.institute_messaging_settings IS
  'Parent messaging policy. wa_auto (Tier 2) is off until the centre is verified.';
COMMENT ON COLUMN public.institute_messaging_settings.wa_auto IS
  'When true, a worker may auto-send queued rows. Default false. Assisted wa.me is the main path.';

ALTER TABLE public.institute_messaging_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ims_select ON public.institute_messaging_settings;
CREATE POLICY ims_select ON public.institute_messaging_settings
  FOR SELECT TO authenticated
  USING (
    public.has_resource_access(owner_id, auth.uid(), 'settings', false)
    OR public.has_resource_access(owner_id, auth.uid(), 'messages', false)
    OR public.has_resource_access(owner_id, auth.uid(), 'attendance', true)
  );

DROP POLICY IF EXISTS ims_insert ON public.institute_messaging_settings;
CREATE POLICY ims_insert ON public.institute_messaging_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_resource_access(owner_id, auth.uid(), 'settings', true));

DROP POLICY IF EXISTS ims_update ON public.institute_messaging_settings;
CREATE POLICY ims_update ON public.institute_messaging_settings
  FOR UPDATE TO authenticated
  USING (public.has_resource_access(owner_id, auth.uid(), 'settings', true))
  WITH CHECK (public.has_resource_access(owner_id, auth.uid(), 'settings', true));

REVOKE ALL ON TABLE public.institute_messaging_settings FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.institute_messaging_settings TO authenticated;
GRANT ALL ON TABLE public.institute_messaging_settings TO service_role;

-- ---------------------------------------------------------------------------
-- Shared outbox for absence / fee_overdue / fee_paid
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  student_id uuid,
  session_id uuid,
  session_date date,
  kind text NOT NULL,
  phone text,
  body text,
  status text NOT NULL,
  skip_reason text,
  dedupe_key text NOT NULL,
  created_by uuid,
  sent_at timestamptz,
  sent_via text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_outbox_kind_chk
    CHECK (kind IN ('absence', 'fee_overdue', 'fee_paid')),
  CONSTRAINT message_outbox_status_chk
    CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  CONSTRAINT message_outbox_sent_via_chk
    CHECK (sent_via IS NULL OR sent_via IN ('wa_me', 'worker')),
  CONSTRAINT message_outbox_owner_dedupe_uidx UNIQUE (owner_id, dedupe_key)
);

COMMENT ON TABLE public.message_outbox IS
  'Parent WhatsApp outbox. A1 writes kind=absence; A2/A3 reuse the same table.';
COMMENT ON COLUMN public.message_outbox.dedupe_key IS
  'Absence: absence:<session_id>:<student_id>. One row per student per session.';

CREATE INDEX IF NOT EXISTS message_outbox_owner_status_idx
  ON public.message_outbox (owner_id, kind, status, created_at DESC);

CREATE INDEX IF NOT EXISTS message_outbox_owner_session_idx
  ON public.message_outbox (owner_id, session_id)
  WHERE kind = 'absence';

ALTER TABLE public.message_outbox ENABLE ROW LEVEL SECURITY;

-- Clients read the queue. Inserts/updates go through DEFINER trigger or service APIs.
DROP POLICY IF EXISTS message_outbox_select ON public.message_outbox;
CREATE POLICY message_outbox_select ON public.message_outbox
  FOR SELECT TO authenticated
  USING (
    public.has_resource_access(owner_id, auth.uid(), 'messages', false)
    OR public.has_resource_access(owner_id, auth.uid(), 'attendance', false)
  );

REVOKE ALL ON TABLE public.message_outbox FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.message_outbox TO authenticated;
GRANT ALL ON TABLE public.message_outbox TO service_role;

-- ---------------------------------------------------------------------------
-- AttendanceMarked(absent) → enqueue. Flip away from absent → skip if still queued.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_absence_parent_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date;
  v_batch text;
  v_centre text;
  v_student text;
  v_phone text;
  v_key text;
  v_body text;
  v_date_label text;
BEGIN
  SELECT sess.session_date, b.name
    INTO v_date, v_batch
  FROM public.attendance_sessions sess
  LEFT JOIN public.batches b
    ON b.id = sess.batch_id AND b.owner_id = sess.owner_id
  WHERE sess.id = NEW.session_id
    AND sess.owner_id = NEW.owner_id;

  IF v_date IS NULL THEN
    RETURN NEW;
  END IF;

  v_key := 'absence:' || NEW.session_id::text || ':' || NEW.student_id::text;

  IF NEW.status IS DISTINCT FROM 'absent' THEN
    UPDATE public.message_outbox
    SET status = 'skipped',
        skip_reason = 'not_absent',
        updated_at = now()
    WHERE owner_id = NEW.owner_id
      AND dedupe_key = v_key
      AND status = 'queued';
    RETURN NEW;
  END IF;

  SELECT s.full_name,
         CASE
           WHEN s.guardian_phone IS NOT NULL
            AND right(regexp_replace(s.guardian_phone, '\D', '', 'g'), 10) ~ '^[6-9][0-9]{9}$'
           THEN '+91' || right(regexp_replace(s.guardian_phone, '\D', '', 'g'), 10)
           WHEN s.phone IS NOT NULL
            AND right(regexp_replace(s.phone, '\D', '', 'g'), 10) ~ '^[6-9][0-9]{9}$'
           THEN '+91' || right(regexp_replace(s.phone, '\D', '', 'g'), 10)
           ELSE NULL
         END
    INTO v_student, v_phone
  FROM public.students s
  WHERE s.id = NEW.student_id
    AND s.owner_id = NEW.owner_id;

  SELECT i.name INTO v_centre
  FROM public.institutes i
  WHERE i.owner_id = NEW.owner_id;

  v_date_label := to_char(v_date, 'DD Mon YYYY');
  v_body := 'Dear parent, '
    || COALESCE(NULLIF(btrim(v_student), ''), 'your child')
    || ' was absent today ('
    || v_date_label
    || ', '
    || COALESCE(NULLIF(btrim(v_batch), ''), 'class')
    || ') at '
    || COALESCE(NULLIF(btrim(v_centre), ''), 'the centre')
    || '. Please contact us if this is unexpected.';

  INSERT INTO public.message_outbox (
    owner_id, student_id, session_id, session_date, kind,
    phone, body, status, skip_reason, dedupe_key, created_by, payload
  ) VALUES (
    NEW.owner_id,
    NEW.student_id,
    NEW.session_id,
    v_date,
    'absence',
    v_phone,
    v_body,
    CASE WHEN v_phone IS NULL THEN 'skipped' ELSE 'queued' END,
    CASE WHEN v_phone IS NULL THEN 'no_phone' ELSE NULL END,
    v_key,
    auth.uid(),
    jsonb_build_object(
      'studentName', COALESCE(v_student, 'your child'),
      'batchName', COALESCE(v_batch, 'class'),
      'sessionDate', v_date::text,
      'centreName', COALESCE(v_centre, 'the centre'),
      'phoneSource', CASE
        WHEN v_phone IS NULL THEN NULL
        ELSE 'parent'
      END
    )
  )
  ON CONFLICT (owner_id, dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_absence_parent_message() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_absence_parent_message() TO service_role;

DROP TRIGGER IF EXISTS trg_absence_parent_message ON public.attendance_records;
CREATE TRIGGER trg_absence_parent_message
  AFTER INSERT OR UPDATE OF status, session_id, student_id ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_absence_parent_message();
