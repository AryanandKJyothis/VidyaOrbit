/**
 * Pure billing predicates shared by routes, the client, and tests.
 *
 * The 7-day mid-term window is counted in Asia/Kolkata calendar dates
 * (same as activate_billing_order in SQL). SQL is the source of truth
 * at payment time; this helper is the create-order gate.
 */
import { DEFAULT_EMAIL, DEFAULT_WHATSAPP_NUMBER } from "@/lib/contact-config";
import { planCodeForTier, type PlanTier } from "@/lib/plan-limits";

export const BILLING_TIME_ZONE = "Asia/Kolkata";

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

/** YYYY-MM-DD in Asia/Kolkata. */
export function kolkataDateString(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BILLING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * Whole calendar days from `now` to `expiry` in Asia/Kolkata.
 * Matches SQL:
 *   (expiry AT TIME ZONE 'Asia/Kolkata')::date
 *   - (now() AT TIME ZONE 'Asia/Kolkata')::date
 */
export function kolkataCalendarDaysUntil(
  expiry: Date,
  now: Date = new Date(),
): number {
  const [ey, em, ed] = kolkataDateString(expiry).split("-").map(Number);
  const [ny, nm, nd] = kolkataDateString(now).split("-").map(Number);
  const expiryUtc = Date.UTC(ey, em - 1, ed);
  const nowUtc = Date.UTC(ny, nm - 1, nd);
  return Math.round((expiryUtc - nowUtc) / 86_400_000);
}

/**
 * Refuse a different paid tier while more than 7 Asia/Kolkata calendar
 * days remain. Same-tier renewals, free accounts, expired plans, and
 * plans with <= 7 days left may buy any tier.
 *
 * activate_billing_order enforces the same rule at capture time so a
 * checkout opened when <= 7 days remain cannot later apply a different
 * tier after a same-tier renewal in another tab.
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

  return kolkataCalendarDaysUntil(expiry, now) > 7;
}

export type BillingSupportContact = {
  link: string | null;
  channel: "whatsapp" | "email" | null;
};

/**
 * Server-side support contact for 409 TIER_CHANGE_CONTACT_SUPPORT.
 * Same VITE_CONTACT_* vars as the client; unset falls back to
 * contact-config.ts built-in defaults so the 409 always has a WhatsApp link.
 * An explicit empty string still hides that channel.
 */
export function getBillingSupportContact(
  env: NodeJS.ProcessEnv = process.env,
): BillingSupportContact {
  const whatsappRaw =
    env.VITE_CONTACT_WHATSAPP === undefined
      ? DEFAULT_WHATSAPP_NUMBER
      : env.VITE_CONTACT_WHATSAPP.trim();
  const emailRaw =
    env.VITE_CONTACT_EMAIL === undefined
      ? DEFAULT_EMAIL
      : env.VITE_CONTACT_EMAIL.trim();
  if (whatsappRaw) {
    return {
      link: `https://wa.me/${whatsappRaw.replace(/\D/g, "")}`,
      channel: "whatsapp",
    };
  }
  if (emailRaw) {
    return { link: `mailto:${emailRaw}`, channel: "email" };
  }
  return { link: null, channel: null };
}

export function tierChangeSupportMessage(
  channel: BillingSupportContact["channel"],
): string {
  if (channel === "whatsapp") {
    return "To change plans, message us on WhatsApp, we'll adjust your remaining time";
  }
  return "To change plans, contact us, we'll adjust your remaining time";
}

/** Fallback copy when the 409 body has no message. */
export const TIER_CHANGE_MESSAGE = tierChangeSupportMessage("whatsapp");

export const TIER_CHANGE_HELD_MESSAGE =
  "Payment received. We'll contact you to switch your plan and adjust your remaining time";

export type PendingFollowup = "success" | "held" | "wait";

/**
 * Same-tier renewals succeed when expiry moves past its old value or the
 * order shows activated. Held orders surface needs-review instead of a
 * silent timeout. Upgrades succeed when the purchased plan becomes active.
 */
export function evaluatePendingFollowup(args: {
  expectedPlan: string;
  previousPlan: string | null | undefined;
  previousExpiry: string | null | undefined;
  subscription: {
    plan?: string;
    status?: string;
    expired?: boolean;
    expiry_date?: string | null;
  } | null;
  order: {
    needs_review?: boolean | null;
    activated_at?: string | null;
  } | null;
}): PendingFollowup {
  if (args.order?.needs_review) return "held";

  const newExpiry = args.subscription?.expiry_date
    ? new Date(args.subscription.expiry_date).getTime()
    : NaN;
  const oldExpiry = args.previousExpiry
    ? new Date(args.previousExpiry).getTime()
    : NaN;
  const expiryMoved =
    Number.isFinite(newExpiry) &&
    (!Number.isFinite(oldExpiry) || newExpiry > oldExpiry);

  const upgraded =
    args.previousPlan !== args.expectedPlan &&
    args.subscription?.plan === args.expectedPlan &&
    args.subscription?.status === "active" &&
    args.subscription?.expired === false;

  if (upgraded || expiryMoved || args.order?.activated_at) return "success";
  return "wait";
}
