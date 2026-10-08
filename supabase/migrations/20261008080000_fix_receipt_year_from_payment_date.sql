-- Migration 4: Fix receipt number generation to use payment_date year instead of now()
-- APPLY ORDER: Skip migrations 1+2, apply 4 and 5 first, then 3a, then deploy frontend, then 3b.
-- This migration changes the live generate_receipt_number function to use the payment_date
-- year instead of the current year, preventing year-boundary edge cases.

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  NEW.receipt_number := v_prefix || '-' || to_char(NEW.payment_date, 'YYYY') || '-' || lpad(v_count::text, 5, '0');
  RETURN NEW;
END;
$function$;

-- Add unique constraint to ensure receipt_number uniqueness per owner
CREATE UNIQUE INDEX IF NOT EXISTS fee_payments_owner_receipt_number_key 
  ON public.fee_payments(owner_id, receipt_number);
