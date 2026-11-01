-- Onboarding v2: sample data flag. Additive only (no drops, renames, or type
-- changes). Existing rows default to false. Rollback:
--   alter table public.students drop column if exists is_sample;
--   alter table public.batches  drop column if exists is_sample;
-- The app only shows the sample-data toggle when VITE_ONBOARDING_SAMPLE_DATA=true.

alter table public.students
  add column if not exists is_sample boolean not null default false;

alter table public.batches
  add column if not exists is_sample boolean not null default false;

create index if not exists students_owner_sample_idx
  on public.students (owner_id) where is_sample;

create index if not exists batches_owner_sample_idx
  on public.batches (owner_id) where is_sample;

comment on column public.students.is_sample is
  'Onboarding demo row. Safe to delete via "Clear sample data"; exclude from billing counts.';
comment on column public.batches.is_sample is
  'Onboarding demo row. Safe to delete via "Clear sample data".';
