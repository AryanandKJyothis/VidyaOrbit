-- Replace COUNT(*) + 1 receipt numbering with an atomic per-owner counter.

CREATE TABLE IF NOT EXISTS public.receipt_counters (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receipt_counters_no_select ON public.receipt_counters;
DROP POLICY IF EXISTS receipt_counters_no_insert ON public.receipt_counters;
DROP POLICY IF EXISTS receipt_counters_no_update ON public.receipt_counters;
DROP POLICY IF EXISTS receipt_counters_no_delete ON public.receipt_counters;

CREATE POLICY receipt_counters_no_select
  ON public.receipt_counters FOR SELECT TO anon, authenticated
  USING (false);
CREATE POLICY receipt_counters_no_insert
  ON public.receipt_counters FOR INSERT TO anon, authenticated
  WITH CHECK (false);
CREATE POLICY receipt_counters_no_update
  ON public.receipt_counters FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY receipt_counters_no_delete
  ON public.receipt_counters FOR DELETE TO anon, authenticated
  USING (false);

GRANT ALL ON public.receipt_counters TO service_role;

INSERT INTO public.receipt_counters (owner_id, last_number)
SELECT owner_id, COUNT(*)::integer
FROM public.fee_payments
GROUP BY owner_id
ON CONFLICT (owner_id) DO UPDATE
SET last_number = GREATEST(public.receipt_counters.last_number, EXCLUDED.last_number),
    updated_at = now();

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_count integer;
BEGIN
  IF NEW.receipt_number IS NOT NULL AND NEW.receipt_number <> '' THEN
    RETURN NEW;
  END IF;

  SELECT receipt_prefix INTO v_prefix
  FROM public.institutes
  WHERE owner_id = NEW.owner_id;

  v_prefix := COALESCE(v_prefix, 'RCT');

  INSERT INTO public.receipt_counters (owner_id, last_number, updated_at)
  VALUES (NEW.owner_id, 1, now())
  ON CONFLICT (owner_id) DO UPDATE
    SET last_number = public.receipt_counters.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO v_count;

  NEW.receipt_number := v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_count::text, 5, '0');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_receipt_number() FROM PUBLIC, anon, authenticated;
