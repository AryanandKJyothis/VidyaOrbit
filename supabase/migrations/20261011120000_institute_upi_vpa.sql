-- Centre UPI ID used in fee-reminder links. Parents pay this VPA directly.
-- VidyaOrbit does not receive or reconcile the money.
ALTER TABLE public.institutes
  ADD COLUMN IF NOT EXISTS upi_vpa text;

COMMENT ON COLUMN public.institutes.upi_vpa IS
  'Centre UPI VPA. Parents pay this ID directly; VidyaOrbit does not receive the money.';
