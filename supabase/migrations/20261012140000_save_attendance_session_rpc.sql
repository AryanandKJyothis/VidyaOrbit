-- VO-069: atomic attendance save (upsert + scoped delete in one transaction).
-- Do NOT apply from this PR. The client uses a safe upsert+scoped-delete
-- fallback until this RPC exists in the live project.

CREATE OR REPLACE FUNCTION public.save_attendance_session(
  p_owner_id uuid,
  p_session_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_resource_access(p_owner_id, auth.uid(), 'attendance', true) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'Mark at least one student before saving.';
  END IF;

  INSERT INTO public.attendance_records (owner_id, session_id, student_id, status)
  SELECT
    p_owner_id,
    p_session_id,
    (row->>'student_id')::uuid,
    row->>'status'
  FROM jsonb_array_elements(p_rows) AS row
  ON CONFLICT (session_id, student_id)
  DO UPDATE SET status = EXCLUDED.status;

  DELETE FROM public.attendance_records
  WHERE session_id = p_session_id
    AND owner_id = p_owner_id
    AND student_id NOT IN (
      SELECT (row->>'student_id')::uuid
      FROM jsonb_array_elements(p_rows) AS row
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_attendance_session(uuid, uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_attendance_session(uuid, uuid, jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.save_attendance_session(uuid, uuid, jsonb) IS
  'VO-069 atomic attendance save. Not applied yet; client has a safe fallback.';
