-- Nov 1 2026 pricing — step 1 of 2. ADDITIVE ONLY. NOT YET APPLIED.
-- Adds the `campus` plan_code (400+ students, unlimited). No rows change.
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction that
-- references the new value, so caps/MRR live in 20261101090100.
ALTER TYPE public.plan_code ADD VALUE IF NOT EXISTS 'campus';
