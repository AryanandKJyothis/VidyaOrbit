-- New columns on institutes need explicit grants when the table uses column-level
-- privileges (admin_notes was revoked from authenticated in 20260529050947).
GRANT SELECT, UPDATE (upi_vpa) ON public.institutes TO authenticated;

-- Ensure table-level read/write for owners (RLS still applies).
GRANT SELECT, INSERT, UPDATE ON public.institutes TO authenticated;
