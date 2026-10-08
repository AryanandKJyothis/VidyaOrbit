/**
 * Pure billing predicates shared by routes, the client, and tests.
 */
import { differenceInCalendarDays } from "date-fns";
import {
  planCodeForTier,
  type PlanCode,
  type PlanTier,
} from "@/lib/plan-limits";

type BillingCycle = "monthly" | "annual";

export const TIER_CHANGE_MESSAGE =
  "To change plans, message us on WhatsApp, we'll adjust your remaining time";

export type SubscriptionGuardRow = {
  plan: string | null;
  plan_price: number | null;
  expiry_date: string | null;
};

export function isCompedSubscription(
  sub: SubscriptionGuardRow | null,
): boolean {
  if (!sub || sub.plan === "free") return false;
  return sub.plan_price === 0 || sub.expiry_date === null;
}

/**
 * Refuse a different paid tier while more than 7 calendar days remain.
 * Same-tier renewals, free accounts, expired plans, and plans with
 * <= 7 days left may buy any tier.
 */
export function isTierChangeBlocked(
  sub: SubscriptionGuardRow | null,
  requestedTier: PlanTier,
  now: Date = new Date(),
): boolean {
  if (!sub || sub.plan === "free" || !sub.plan) return false;
  if (isCompedSubscription(sub)) return false;

  const requestedPlan = planCodeForTier(requestedTier);
  if (requestedPlan === sub.plan) return false;

  const paid = sub.plan_price != null && Number(sub.plan_price) > 0;
  if (!paid || !sub.expiry_date) return false;

  const expiry = new Date(sub.expiry_date);
  if (Number.isNaN(expiry.getTime())) return false;
  if (expiry.getTime() <= now.getTime()) return false;

  return differenceInCalendarDays(expiry, now) > 7;
}

/** Mirrors SQL GREATEST(now(), COALESCE(expiry, now())) + 1 or 12 months. */
export function computeNewExpiry(
  now: Date,
  currentExpiry: Date | string | null | undefined,
  cycle: BillingCycle,
): Date {
  const expiryDate =
    currentExpiry == null
      ? null
      : currentExpiry instanceof Date
        ? currentExpiry
        : new Date(currentExpiry);
  const validExpiry =
    expiryDate && !Number.isNaN(expiryDate.getTime()) ? expiryDate : null;
  const base =
    validExpiry && validExpiry.getTime() > now.getTime() ? validExpiry : now;
  const months = cycle === "annual" ? 12 : 1;
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth() + months,
      base.getUTCDate(),
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
      base.getUTCMilliseconds(),
    ),
  );
}
