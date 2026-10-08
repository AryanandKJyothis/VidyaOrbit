# PR #4 Final QA Report - Ready for Review

## Commit SHA

**HEAD:** `be79acaf24c9069f78b6ae3655de9e18331c664b`

## Build & Type Safety

✅ **TypeScript typecheck:** PASSED  
✅ **Production build:** PASSED  
✅ **Vercel preview:** READY ([deployment](https://vercel.com/aryanandkjyothis5-1347s-projects/vidya-orbit/76wSm3Muh6J9T4LJoZ8kpko8LfZs))

## Migration Apply Order

The following migrations are included in this PR and must be applied in the correct sequence to avoid breaking production:

### Phase 1: Pre-frontend Changes (Apply to production DB first)

**Skip migrations 1 & 2** (already applied via hotfix)

1. **Migration 4:** `20261008080000_fix_receipt_year_from_payment_date.sql`
   - Fixes receipt number generation to use `payment_date` year instead of `now()`
   - Adds unique constraint on `fee_payments(owner_id, receipt_number)`
   - **Safe to apply:** Does not break existing code

2. **Migration 5:** `20261008080100_copy_signup_phone_to_institute.sql`
   - Copies signup phone to `institutes.phone`
   - **Safe to apply:** Does not break existing code

### Phase 2: Create View (Still before frontend deploy)

3. **Migration 3a:** `20261008074500_gate_student_fee_amounts_3a_view.sql`
   - Creates `students_gated` view with `security_invoker = false`
   - Uses `has_resource_access(owner_id, auth.uid(), 'fees', false)` for fee column gating
   - **Safe to apply:** View is created but not used yet by frontend

### Phase 3: Deploy Frontend

4. **Deploy this PR branch to production**
   - Frontend now reads exclusively via `students_gated` view
   - All writes verified safe (no `.select()` returning fee columns)

### Phase 4: Enforce Column-Level Security (Only after frontend is live)

5. **Migration 3b:** `20261008074501_gate_student_fee_amounts_3b_revoke_trigger.sql`
   - Revokes table-level SELECT on `students`
   - Grants column-level SELECT on non-fee columns only
   - Adds trigger to prevent unauthorized fee writes
   - Trigger now handles `service_role` and superuser writes correctly
   - **Critical:** Only apply after frontend deploy is confirmed working

## Students Reference Audit (Migration 3b Readiness)

### Summary

All 7 student table references in `src/` are safe for Migration 3b:

- **2 READ operations** use `students_gated` view
- **5 WRITE operations** do not return data (no `.select()` call)
- **0 embedded student selects** found

### Detailed Audit

See `docs/migration-3b-student-audit.md` for line-by-line analysis.

#### READ Operations

1. ✅ `src/hooks/use-data.ts:96` - `useStudents()` → uses `students_gated`
2. ✅ `src/hooks/use-data.ts:118` - `useStudent(id)` → uses `students_gated`

#### WRITE Operations (No data returned)

3. ✅ `src/hooks/use-data.ts:201` - UPDATE student
4. ✅ `src/hooks/use-data.ts:208` - INSERT student
5. ✅ `src/components/import-students-dialog.tsx:308` - Bulk UPDATE
6. ✅ `src/components/import-students-dialog.tsx:339` - Bulk INSERT
7. ✅ `src/routes/_authenticated/students.tsx:139` - Archive/restore

## Fixes Completed

### 1. Blocker 2: React Hooks Order ✅

- **Fixed:** `src/routes/_authenticated/fees.tsx`
  - Moved `if (loading) return (...)` below ALL hooks
  - Removed duplicate memos (`batchMap`/`studentTotalPaid` vs `paidByStudent`)
- **Verified:** All other route components have correct hook ordering
  - `students.$id.tsx`, `plan-gate.tsx`, `route-permission-gate.tsx` - early returns are AFTER hooks ✅
  - `attendance.tsx` - early returns are inside useEffect callbacks (valid) ✅

### 2. Migration 4: Receipt Year from Payment Date ✅

- **Re-added:** `supabase/migrations/20261008080000_fix_receipt_year_from_payment_date.sql`
- **Changes:** Exact copy of live `generate_receipt_number()` function
  - Only change: `to_char(now(), 'YYYY')` → `to_char(NEW.payment_date, 'YYYY')`
  - Keeps `receipt_counters` upsert logic unchanged
  - Adds unique constraint: `fee_payments(owner_id, receipt_number)`

### 3. Migration 3b Readiness: Students Reference Audit ✅

- **Completed:** Comprehensive grep audit of all `src/` for `.from("students")` and `students(...)` selects
- **Result:** All 7 references verified safe (see audit above)
- **Documentation:** Full audit report in `docs/migration-3b-student-audit.md`

### 4. Migration 3b Trigger Hardening ✅

- **Updated:** `supabase/migrations/20261008074501_gate_student_fee_amounts_3b_revoke_trigger.sql`
- **Changes:**
  - Allow writes when `auth.role() = 'service_role'` (background jobs, admin operations)
  - Allow writes when `current_user IN ('postgres', 'supabase_admin')` (superusers)
  - On INSERT, only check when fee fields are non-null (`NEW.fee_total IS NOT NULL OR NEW.fee_due_date IS NOT NULL`)
  - Maintains apply-order header warning

### 5. Non-blocking Polish Items ✅

#### a. Workspaces Loading Skeleton

- **Fixed:** `src/components/route-permission-gate.tsx`
- Shows skeleton during `workspaceLoading` instead of temporary "Access denied"

#### b. Billing Route Guard

- **Fixed:** `src/routes/_authenticated/billing.tsx`
- Added `<RoutePermissionGate resource="billing" level="read">` wrapper

#### c. Hide Overdue Badge for Non-fees Users

- **Fixed:** `src/routes/_authenticated/students.tsx`
- Changed `{overdue ? (` to `{canViewFees && overdue ? (` in both table and card views

#### d. Move "Today's Batches" Out of Fee Block

- **Fixed:** `src/routes/_authenticated/dashboard.tsx`
- "Today's batches" card now renders independently, outside `{canViewFees && (...)}`
- All users can see today's scheduled classes

#### e. Clear Query Cache on Logout

- **Fixed:** `src/components/app-sidebar.tsx`
- Added `qc.clear()` after successful `supabase.auth.signOut()`

## Master Branch Status

✅ **CONFIRMED:** Master branch was NOT touched during this work

- Last commit on master: `c2cf725` (Revert PR #5)
- All work committed and pushed only to `cursor/pre-pitch-qa-fixes-870a`

## Next Steps

1. ✅ Typecheck and build passed
2. ✅ Vercel preview deployed successfully
3. ✅ All 10 blocker items resolved
4. ✅ All non-blocking polish items completed
5. ✅ Student reference audit completed and documented
6. ✅ Migration apply order documented
7. ✅ Master branch untouched

**PR #4 is ready for final review and merge.**
