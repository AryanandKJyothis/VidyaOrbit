-- Fix receipt number year: use payment_date instead of now()
-- Bug: Receipt numbers use the insert timestamp (now()) for the year,
-- so backdated payments get the current year instead of the payment year.
-- Fix: Use NEW.payment_date for the year component.

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix TEXT;
  v_count BIGINT;
BEGIN
  IF NEW.receipt_number IS NOT NULL AND NEW.receipt_number <> '' THEN
    RETURN NEW;
  END IF;

  SELECT receipt_prefix INTO v_prefix
    FROM public.institutes
   WHERE owner_id = NEW.owner_id
   LIMIT 1;

  IF v_prefix IS NULL OR v_prefix = '' THEN
    v_prefix := 'RCT';
  END IF;

  -- Use payment_date (not now()) for the year, so backdated payments get the correct year
  SELECT COUNT(*) + 1 INTO v_count
    FROM public.fee_payments
   WHERE owner_id = NEW.owner_id
     AND EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM NEW.payment_date);

  NEW.receipt_number := v_prefix || '-' || to_char(NEW.payment_date, 'YYYY') || '-' || lpad(v_count::text, 5, '0');
  RETURN NEW;
END;
$function$;

-- Revoke remains the same (already hardened)
REVOKE ALL ON FUNCTION public.generate_receipt_number() FROM PUBLIC, anon, authenticated;
