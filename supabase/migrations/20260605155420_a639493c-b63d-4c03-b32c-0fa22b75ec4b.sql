
-- Composite indexes matching frequent access patterns (owner + sort/filter)
CREATE INDEX IF NOT EXISTS idx_students_owner_created ON public.students (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_owner_status ON public.students (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_owner_date ON public.fee_payments (owner_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_owner_student_date ON public.fee_payments (owner_id, student_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_batches_owner_active ON public.batches (owner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_att_sessions_owner_date ON public.attendance_sessions (owner_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_att_records_owner_session ON public.attendance_records (owner_id, session_id);
