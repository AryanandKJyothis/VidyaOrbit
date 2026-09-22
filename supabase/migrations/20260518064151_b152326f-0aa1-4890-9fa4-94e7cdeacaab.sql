
-- Institutes (one per owner; holds settings)
CREATE TABLE public.institutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Institute',
  logo_url TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  address TEXT,
  receipt_prefix TEXT NOT NULL DEFAULT 'RCT',
  receipt_footer TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  teacher_name TEXT,
  timing TEXT,
  days_of_week TEXT[] NOT NULL DEFAULT '{}',
  capacity INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_batches_owner ON public.batches(owner_id);

CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  address TEXT,
  joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active', -- active | inactive | archived
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  fee_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  fee_due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_owner ON public.students(owner_id);
CREATE INDEX idx_students_batch ON public.students(batch_id);
CREATE INDEX idx_students_status ON public.students(status);

CREATE TABLE public.fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT 'cash', -- cash | upi | card | bank | other
  reference TEXT,
  notes TEXT,
  receipt_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_owner ON public.fee_payments(owner_id);
CREATE INDEX idx_payments_student ON public.fee_payments(student_id);
CREATE INDEX idx_payments_date ON public.fee_payments(payment_date DESC);

CREATE TABLE public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(batch_id, session_date)
);
CREATE INDEX idx_att_sessions_owner ON public.attendance_sessions(owner_id);

CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present', -- present | absent | late
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);
CREATE INDEX idx_att_records_owner ON public.attendance_records(owner_id);
CREATE INDEX idx_att_records_student ON public.attendance_records(student_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_institutes_updated BEFORE UPDATE ON public.institutes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_batches_updated BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create institute on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.institutes (owner_id, name, contact_email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'institute_name', 'My Institute'), NEW.email)
  ON CONFLICT (owner_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Receipt number generator
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_prefix TEXT;
  v_count INTEGER;
BEGIN
  IF NEW.receipt_number IS NOT NULL AND NEW.receipt_number <> '' THEN
    RETURN NEW;
  END IF;
  SELECT receipt_prefix INTO v_prefix FROM public.institutes WHERE owner_id = NEW.owner_id;
  v_prefix := COALESCE(v_prefix, 'RCT');
  SELECT COUNT(*)+1 INTO v_count FROM public.fee_payments WHERE owner_id = NEW.owner_id;
  NEW.receipt_number := v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_count::text, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_receipt_number BEFORE INSERT ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.generate_receipt_number();

-- Enable RLS
ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS policies: owner_id = auth.uid()
CREATE POLICY "own institute" ON public.institutes FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own batches" ON public.batches FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own students" ON public.students FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own payments" ON public.fee_payments FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own att sessions" ON public.attendance_sessions FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own att records" ON public.attendance_records FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
