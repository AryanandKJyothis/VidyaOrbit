-- Hotfix for 20261101100000_add_is_sample.sql. public.students uses
-- column-level SELECT grants for `authenticated`, so the new is_sample column
-- was not readable: "Clear sample data" (count + delete filtered on is_sample)
-- returned 403 permission denied. is_sample is a non-sensitive boolean; RLS
-- still scopes rows to the owner/workspace.
-- Rollback: revoke select (is_sample) on public.students from authenticated;
grant select (is_sample) on public.students to authenticated;
