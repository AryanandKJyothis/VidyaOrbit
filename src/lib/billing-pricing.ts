/**
 * Razorpay in-app checkout pricing configuration (v3 - tier + cycle model)
 * Server-side pricing configuration and logic.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  PLAN_STUDENT_LIMITS,
  UNLIMITED_STUDENT_SENTINEL,
  planCodeForTier,
} from "@/lib/plan-limits";

export type PlanTier = "starter" | "growth" | "large";
export type BillingCycle = "monthly" | "annual";

export type LineItem = {
  item: "setup_fee" | "subscription_charge";
  amount: number; // paise
};

export type PricingResult = {
  total: number; // paise
  currency: string;
  line_items: LineItem[];
  tier: PlanTier;
  cycle: BillingCycle;
  months: number; // 1 for monthly, 12 for annual
};

// ── Plan Configuration (server-side, env-overridable) ──
export type TierConfig = {
  tier: PlanTier;
  student_limit: number;
  setup_fee_paise: number;
  monthly_price_paise: number;
  annual_price_paise: number;
  display_name: string;
  description: string;
};

// Helper to get env var with fallback and validation
function getEnvInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (!val) return fallback;
  const parsed = parseInt(val, 10);

  // Validate: must be a positive integer >= 100 paise for prices, >= 0 for setup
  if (isNaN(parsed)) {
    console.warn(
      `[billing-pricing] Invalid ${key}: "${val}" is not a number, using fallback ${fallback}`,
    );
    return fallback;
  }

  if (key.includes("SETUP") && parsed < 0) {
    console.warn(
      `[billing-pricing] Invalid ${key}: ${parsed} is negative, using fallback ${fallback}`,
    );
    return fallback;
  }

  if (!key.includes("SETUP") && parsed < 100) {
    console.warn(
      `[billing-pricing] Invalid ${key}: ${parsed} is less than 100 paise, using fallback ${fallback}`,
    );
    return fallback;
  }

  return parsed;
}

export const TIER_CONFIGS: Record<PlanTier, TierConfig> = {
  starter: {
    tier: "starter",
    student_limit: PLAN_STUDENT_LIMITS.starter ?? 100,
    setup_fee_paise: getEnvInt("BILLING_STARTER_SETUP_FEE_PAISE", 0), // ₹0 (free)
    monthly_price_paise: getEnvInt(
      "BILLING_STARTER_MONTHLY_PRICE_PAISE",
      49900,
    ), // ₹499
    annual_price_paise: getEnvInt("BILLING_STARTER_ANNUAL_PRICE_PAISE", 499900), // ₹4,999
    display_name: "Starter",
    description: "Up to 100 students",
  },
  growth: {
    tier: "growth",
    student_limit: PLAN_STUDENT_LIMITS.growth ?? 500,
    setup_fee_paise: getEnvInt("BILLING_GROWTH_SETUP_FEE_PAISE", 500000), // ₹5,000 (monthly only)
    monthly_price_paise: getEnvInt("BILLING_GROWTH_MONTHLY_PRICE_PAISE", 99900), // ₹999
    annual_price_paise: getEnvInt("BILLING_GROWTH_ANNUAL_PRICE_PAISE", 1000000), // ₹10,000
    display_name: "Growth",
    description: "Up to 500 students",
  },
  large: {
    tier: "large",
    student_limit: UNLIMITED_STUDENT_SENTINEL,
    setup_fee_paise: getEnvInt("BILLING_LARGE_SETUP_FEE_PAISE", 500000), // ₹5,000 (monthly only)
    monthly_price_paise: getEnvInt("BILLING_LARGE_MONTHLY_PRICE_PAISE", 249900), // ₹2,499
    annual_price_paise: getEnvInt("BILLING_LARGE_ANNUAL_PRICE_PAISE", 2500000), // ₹25,000
    display_name: "Large",
    description: "Unlimited students",
  },
};

/**
 * Get tier config.
 */
export function getTierConfig(tier: PlanTier): TierConfig {
  return TIER_CONFIGS[tier];
}

/**
 * Validate tier.
 */
export function isValidTier(tier: string): tier is PlanTier {
  return tier === "starter" || tier === "growth" || tier === "large";
}

/**
 * Validate cycle.
 */
export function isValidCycle(cycle: string): cycle is BillingCycle {
  return cycle === "monthly" || cycle === "annual";
}

/**
 * Compute pricing for a plan purchase.
 * Setup rule: charged only on first paid order, and only for monthly cycle on Growth/Large tiers.
 * Annual waives setup fee.
 * @param tier The plan tier ('starter', 'growth', or 'large')
 * @param cycle The billing cycle ('monthly' or 'annual')
 * @param hasPriorPaidOrder Whether the workspace has any paid order
 */
export function computePricing(
  tier: PlanTier,
  cycle: BillingCycle,
  hasPriorPaidOrder: boolean,
): PricingResult {
  const config = getTierConfig(tier);
  const line_items: LineItem[] = [];

  // Setup fee rule:
  // - Annual: setup is waived (₹0)
  // - Monthly: setup charged only on first paid order (if hasPriorPaidOrder = false)
  // - Starter: setup is ₹0 for both cycles
  if (!hasPriorPaidOrder && cycle === "monthly" && config.setup_fee_paise > 0) {
    line_items.push({ item: "setup_fee", amount: config.setup_fee_paise });
  }

  // Subscription charge based on cycle
  const price =
    cycle === "monthly"
      ? config.monthly_price_paise
      : config.annual_price_paise;
  line_items.push({ item: "subscription_charge", amount: price });

  const total = line_items.reduce((sum, item) => sum + item.amount, 0);

  return {
    total,
    currency: "INR",
    line_items,
    tier,
    cycle,
    months: cycle === "monthly" ? 1 : 12,
  };
}

export type SetupFeeSubscriptionRow = {
  setup_fee_paid?: boolean | null;
  plan?: string | null;
  expiry_date?: string | null;
};

/**
 * Setup is already paid when:
 * - admin flagged subscriptions.setup_fee_paid, or
 * - any current/past paid plan (plan other than free, or an expiry/paid_until), or
 * - an activated online billing_order exists.
 */
export function setupFeePaidFromSubscription(
  sub: SetupFeeSubscriptionRow | null | undefined,
): boolean {
  if (!sub) return false;
  if (sub.setup_fee_paid) return true;
  if (sub.plan && sub.plan !== "free") return true;
  if (sub.expiry_date) return true;
  return false;
}

/**
 * Whether this workspace should skip the online setup fee.
 * Throws on DB error (never silently overcharge setup).
 */
export async function hasSetupFeePaid(
  ownerId: string,
  db: SupabaseClient<Database>,
  sub?: SetupFeeSubscriptionRow | null,
): Promise<boolean> {
  let row = sub;
  if (row === undefined) {
    const { data, error: subErr } = await db
      .from("subscriptions")
      .select("setup_fee_paid, plan, expiry_date")
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (subErr) throw subErr;
    row = data;
  }
  if (setupFeePaidFromSubscription(row)) return true;

  const { count, error } = await db
    .from("billing_orders")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .not("activated_at", "is", null);

  if (error) throw error;
  return (count ?? 0) > 0;
}

/** @deprecated Use hasSetupFeePaid */
export const hasAnyPaidOrder = hasSetupFeePaid;

/**
 * Get the appropriate plan code for subscriptions table based on tier.
 * Maps billing tiers to subscription plan codes.
 */
export function getSubscriptionPlanCode(
  tier: PlanTier,
): "starter" | "growth" | "pro" {
  return planCodeForTier(tier);
}

/**
 * Test/live guard: refuse to run with live keys unless explicitly allowed.
 */
export function assertRazorpayKeyMode(keyId: string | undefined): void {
  if (!keyId) {
    throw new Error("RAZORPAY_KEY_ID is not set");
  }

  const isLive = keyId.startsWith("rzp_live_");
  const allowLive = process.env.RAZORPAY_ALLOW_LIVE?.toLowerCase() === "true";

  if (isLive && !allowLive) {
    throw new Error(
      "Refusing to use live Razorpay keys without RAZORPAY_ALLOW_LIVE=true",
    );
  }
}

/**
 * Server-side billing enabled flag.
 * MUST default to OFF (false) for safety.
 */
export function isBillingEnabled(): boolean {
  const enabled = process.env.BILLING_ENABLED?.toLowerCase() === "true";
  return enabled;
}
