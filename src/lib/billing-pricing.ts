/**
 * Razorpay in-app checkout pricing configuration (v3 - tier + cycle model)
 * Server-only — never send these values to the client.
 */

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

// Helper to get env var with fallback
function getEnvInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}

export const TIER_CONFIGS: Record<PlanTier, TierConfig> = {
  starter: {
    tier: "starter",
    student_limit: getEnvInt("BILLING_STARTER_STUDENT_LIMIT", 100),
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
    student_limit: getEnvInt("BILLING_GROWTH_STUDENT_LIMIT", 500),
    setup_fee_paise: getEnvInt("BILLING_GROWTH_SETUP_FEE_PAISE", 500000), // ₹5,000 (monthly only)
    monthly_price_paise: getEnvInt("BILLING_GROWTH_MONTHLY_PRICE_PAISE", 99900), // ₹999
    annual_price_paise: getEnvInt("BILLING_GROWTH_ANNUAL_PRICE_PAISE", 1000000), // ₹10,000
    display_name: "Growth",
    description: "Up to 500 students",
  },
  large: {
    tier: "large",
    student_limit: getEnvInt(
      "BILLING_LARGE_STUDENT_LIMIT",
      Number.MAX_SAFE_INTEGER,
    ), // Unlimited
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
 * @param hasPaidSetup Whether the workspace has paid setup fee before
 */
export function computePricing(
  tier: PlanTier,
  cycle: BillingCycle,
  hasPaidSetup: boolean,
): PricingResult {
  const config = getTierConfig(tier);
  const line_items: LineItem[] = [];

  // Setup fee rule:
  // - Annual: setup is waived (₹0)
  // - Monthly: setup charged only on first paid order (if hasPaidSetup = false)
  // - Starter: setup is ₹0 for both cycles
  if (!hasPaidSetup && cycle === "monthly" && config.setup_fee_paise > 0) {
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

/**
 * Check if the workspace has ever paid a setup fee.
 */
export async function hasPaidSetupFee(
  ownerId: string,
  supabaseAdmin: any,
): Promise<boolean> {
  // Check if any paid order includes setup_fee in line_items
  const { data: orders } = await supabaseAdmin
    .from("billing_orders")
    .select("line_items")
    .eq("owner_id", ownerId)
    .eq("status", "paid");

  if (!orders || orders.length === 0) return false;

  return orders.some((order: any) => {
    const items = order.line_items;
    if (!Array.isArray(items)) return false;
    return items.some((item: any) => item.item === "setup_fee");
  });
}

/**
 * Get the appropriate plan code for subscriptions table based on tier.
 * Maps billing tiers to subscription plan codes.
 */
export function getSubscriptionPlanCode(
  tier: PlanTier,
): "starter" | "growth" | "pro" {
  // starter -> starter (100 students)
  // growth -> growth (500 students)
  // large -> pro (unlimited)
  if (tier === "starter") return "starter";
  if (tier === "growth") return "growth";
  return "pro";
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
