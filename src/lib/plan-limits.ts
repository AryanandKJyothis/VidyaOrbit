/**
 * Single source of truth for plan student caps used by the admin UI
 * and the client subscription hook. Matches public.plan_student_limit
 * after 20261101090000_pricing_2026_11_01_plan_caps.sql
 * (Nov 1 2026 pricing: free 25, Spark 50, Orbit 150, Centre 400, Campus unlimited).
 * NOTE: until that migration is applied, the DB still enforces the old caps.
 */

export type PlanCode = "free" | "starter" | "growth" | "pro" | "campus";
export type PlanTier = "starter" | "growth" | "large";

/** Postgres integer sentinel used by plan_student_limit for unlimited pro. */
export const UNLIMITED_STUDENT_SENTINEL = 2147483647;

/**
 * Cap per plan_code. `null` means unlimited (campus / Campus).
 * Above ~800 students or multi-branch is a custom quote (still `campus`).
 * Do not override these from env — the DB function is authoritative.
 */
export const PLAN_STUDENT_LIMITS: Record<PlanCode, number | null> = {
  free: 25,
  starter: 50,
  growth: 150,
  pro: 400,
  campus: null,
};

export const PLAN_DISPLAY_NAMES: Record<PlanCode, string> = {
  free: "Free",
  starter: "Spark",
  growth: "Orbit",
  pro: "Centre",
  campus: "Campus",
};

export function planCodeForTier(tier: PlanTier): "starter" | "growth" | "pro" {
  if (tier === "starter") return "starter";
  if (tier === "growth") return "growth";
  return "pro";
}

export function studentLimitForPlan(plan: PlanCode): number | null {
  return PLAN_STUDENT_LIMITS[plan];
}

export function studentLimitForTier(tier: PlanTier): number | null {
  return studentLimitForPlan(planCodeForTier(tier));
}

export function isUnlimited(limit: number | null | undefined): boolean {
  return (
    limit == null ||
    !Number.isFinite(limit) ||
    limit >= UNLIMITED_STUDENT_SENTINEL
  );
}

/** Map a DB/RPC cap to a client number. Sentinel and above become Infinity. */
export function toClientLimit(limit: number | null | undefined): number {
  if (isUnlimited(limit)) return Infinity;
  return limit as number;
}

/** Remaining import/add slots. Unlimited plans never cap at a finite number. */
export function remainingStudentSlots(
  limit: number | null | undefined,
  currentCount: number,
): number {
  if (isUnlimited(limit)) return Infinity;
  return Math.max(0, (limit as number) - currentCount);
}

/** Matches enforce_student_limit / subscription_health: archived rows do not count. */
export function countStudentsTowardPlanLimit(
  students: { status: string }[] | null | undefined,
): number {
  return (students ?? []).filter((s) => s.status !== "archived").length;
}

/**
 * Prefer the server active count. Fall back to a client filter of the
 * loaded roster so the Add button cannot block on archived rows.
 */
export function planLimitHeadcount(
  serverCount: number | null | undefined,
  students: { status: string }[] | null | undefined,
): number {
  if (typeof serverCount === "number" && Number.isFinite(serverCount)) {
    return serverCount;
  }
  return countStudentsTowardPlanLimit(students);
}

export function atStudentPlanLimit(
  currentCount: number,
  limit: number | null | undefined,
): boolean {
  if (isUnlimited(limit)) return false;
  return currentCount >= (limit as number);
}

/** Restore adds one active seat. Block when the institute is already at cap. */
export function canRestoreArchivedStudent(
  currentCount: number,
  limit: number | null | undefined,
): boolean {
  return !atStudentPlanLimit(currentCount, limit);
}

/** @deprecated Use isUnlimited */
export const isUnlimitedLimit = isUnlimited;

export function formatLimit(limit: number | null | undefined): string {
  if (isUnlimited(limit)) return "Unlimited";
  return String(limit);
}

/** @deprecated Use formatLimit */
export const formatStudentLimit = formatLimit;

/** Pre Nov 1 2026 caps — only used to seed grandfathered overrides. */
export const LEGACY_PLAN_STUDENT_LIMITS: Record<PlanCode, number | null> = {
  free: 25,
  starter: 100,
  growth: 500,
  pro: null,
  campus: null,
};

/**
 * Mirrors public.effective_student_limit: a grandfathered override applies
 * only while the centre is still on the plan it was grandfathered on, and
 * never lowers the plan cap. `null` = unlimited.
 */
export function effectiveStudentLimit(input: {
  plan: PlanCode;
  override?: number | null;
  grandfatheredPlan?: PlanCode | null;
}): number | null {
  const base = studentLimitForPlan(input.plan);
  const o = input.override;
  if (o == null || input.grandfatheredPlan !== input.plan) return base;
  if (base === null || isUnlimited(o)) return null;
  return Math.max(base, o);
}

/** Mirrors the grandfather seed: who gets an override, and how big. */
export function grandfatherOverrideFor(
  plan: PlanCode,
  activeStudents: number,
): number | null {
  if (plan !== "starter" && plan !== "growth" && plan !== "pro") return null;
  const cap = studentLimitForPlan(plan);
  if (cap === null || activeStudents <= cap) return null;
  return LEGACY_PLAN_STUDENT_LIMITS[plan] ?? UNLIMITED_STUDENT_SENTINEL;
}
