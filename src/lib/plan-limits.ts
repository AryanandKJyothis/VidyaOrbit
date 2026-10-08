/**
 * Single source of truth for plan student caps used by the admin UI
 * and the client subscription hook. Matches public.plan_student_limit
 * after 20261008093000_pro_plan_unlimited.sql (pro is unlimited).
 */

export type PlanCode = "free" | "starter" | "growth" | "pro";
export type PlanTier = "starter" | "growth" | "large";

/** Postgres integer sentinel used by plan_student_limit for unlimited pro. */
export const UNLIMITED_STUDENT_SENTINEL = 2147483647;

/**
 * Cap per plan_code. `null` means unlimited (pro / Large).
 * Do not override these from env — the DB function is authoritative.
 */
export const PLAN_STUDENT_LIMITS: Record<PlanCode, number | null> = {
  free: 25,
  starter: 100,
  growth: 500,
  pro: null,
};

export const PLAN_DISPLAY_NAMES: Record<PlanCode, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  pro: "Large",
};

export function planCodeForTier(tier: PlanTier): Exclude<PlanCode, "free"> {
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
    limit === Infinity ||
    limit === UNLIMITED_STUDENT_SENTINEL ||
    !Number.isFinite(limit)
  );
}

/** @deprecated Use isUnlimited */
export const isUnlimitedLimit = isUnlimited;

export function formatLimit(limit: number | null | undefined): string {
  if (isUnlimited(limit)) return "Unlimited";
  return String(limit);
}

/** @deprecated Use formatLimit */
export const formatStudentLimit = formatLimit;
