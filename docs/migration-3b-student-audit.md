# Migration 3b Student Reference Audit

## Summary
After Migration 3b, the `students` table will have column-level RLS that revokes SELECT on `fee_total` and `fee_due_date` from the authenticated role. Only users with `fees:read` permission can access these columns through the `students_gated` view.

This audit confirms that all student references in `src/` are safe for Migration 3b.

## READ Operations (Must use students_gated or non-fee columns)

### ✅ src/hooks/use-data.ts:96 - useStudents()
```typescript
.from("students_gated" as "students")
.select("*")
```
**Status:** SAFE - Uses `students_gated` view which handles permission gating

### ✅ src/hooks/use-data.ts:118 - useStudent(id)
```typescript
.from("students_gated" as "students")
.select("*")
```
**Status:** SAFE - Uses `students_gated` view which handles permission gating

## WRITE Operations (Must not return * or fee columns)

### ✅ src/hooks/use-data.ts:201 - useUpsertStudent() UPDATE
```typescript
.from("students")
.update(payload)
.eq("id", id)
```
**Status:** SAFE - No `.select()` call, returns nothing

### ✅ src/hooks/use-data.ts:208 - useUpsertStudent() INSERT
```typescript
.from("students")
.insert(payload as never)
```
**Status:** SAFE - No `.select()` call, returns nothing

### ✅ src/components/import-students-dialog.tsx:308 - Bulk update
```typescript
.from("students")
.update({
  full_name: r.full_name,
  phone: r.phone,
  guardian_name: r.guardian_name,
  guardian_phone: r.guardian_phone,
  batch_id: r.batch_id ?? defaultBatch,
  fee_total: r.fee_total || defaultFee,
  ...(r.joining_date ? { joining_date: r.joining_date } : {}),
})
.eq("id", r.existingStudentId!)
```
**Status:** SAFE - No `.select()` call, returns nothing. Note: This UPDATE includes `fee_total`, which is allowed because writes are unrestricted by Migration 3b (only reads are gated).

### ✅ src/components/import-students-dialog.tsx:339 - Bulk insert
```typescript
.from("students")
.insert(part as never[])
```
**Status:** SAFE - No `.select()` call, returns nothing

### ✅ src/routes/_authenticated/students.tsx:139 - Archive/restore
```typescript
.from("students")
.update({ status: next })
.eq("id", s.id)
```
**Status:** SAFE - No `.select()` call, returns nothing

## Embedded Student Selects
**Found:** 0 references to `students(...)` in embedded selects
**Status:** N/A

## Conclusion
All 7 student table references are safe for Migration 3b:
- 2 READ operations use `students_gated` view with proper permission gating
- 5 WRITE operations do not return data (no `.select()` call)
- 0 embedded student selects found

**Migration 3b can proceed without breaking any existing queries.**
