/**
 * Razorpay in-app checkout pricing configuration (v2)
 * Server-only — never send these values to the client.
 */

export type PlanId = "annual_500" | "annual_large";

export type LineItem = {
  item: "setup_fee" | "annual_plan";
  amount: number; // paise
};

export type PricingResult = {
  total: number; // paise
  currency: string;
  line_items: LineItem[];
  plan_id: PlanId;
};

// ── Plan Configuration (server-side, env-overridable) ──
export type PlanConfig = {
  id: PlanId;
  annual_price_paise: number;
  student_limit: number; // Use Number.MAX_SAFE_INTEGER for unlimited
  setup_fee_paise: number;
  display_name: string;
  description: string;
};

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  annual_500: {
    id: "annual_500",
    annual_price_paise: parseInt(
      process.env.BILLING_ANNUAL_500_PRICE_PAISE ?? "1000000", // ₹10,000
      10,
    ),
    student_limit: parseInt(
      process.env.BILLING_ANNUAL_500_STUDENT_LIMIT ?? "500",
      10,
    ),
    setup_fee_paise: parseInt(
      process.env.BILLING_ANNUAL_500_SETUP_FEE_PAISE ?? "500000", // ₹5,000
      10,
    ),
    display_name: "Annual Plan (500 students)",
    description: "For growing coaching centres",
  },
  annual_large: {
    id: "annual_large",
    annual_price_paise: parseInt(
      process.env.BILLING_ANNUAL_LARGE_PRICE_PAISE ?? "2500000", // ₹25,000
      10,
    ),
    student_limit: parseInt(
      process.env.BILLING_ANNUAL_LARGE_STUDENT_LIMIT ?? String(Number.MAX_SAFE_INTEGER), // Unlimited
      10,
    ),
    setup_fee_paise: parseInt(
      process.env.BILLING_ANNUAL_LARGE_SETUP_FEE_PAISE ?? "500000", // ₹5,000
      10,
    ),
    display_name: "Annual Plan (Large centres)",
    description: "For institutions with 1,000+ students",
  },
};

/**
 * Get plan config by ID.
 */
export function getPlanConfig(planId: PlanId): PlanConfig {
  return PLAN_CONFIGS[planId];
}

/**
 * Validate plan ID.
 */
export function isValidPlanId(planId: string): planId is PlanId {
  return planId === "annual_500" || planId === "annual_large";
}

/**
 * Compute pricing for a plan purchase.
 * @param planId The plan being purchased ('annual_500' or 'annual_large')
 * @param hasPaidSetup Whether the workspace has paid setup fee before (checked from billing_orders)
 */
export function computePricing(
  planId: PlanId,
  hasPaidSetup: boolean,
): PricingResult {
  const plan = getPlanConfig(planId);
  const line_items: LineItem[] = [];

  // Setup fee only if not already paid
  if (!hasPaidSetup) {
    line_items.push({ item: "setup_fee", amount: plan.setup_fee_paise });
  }

  // Annual plan charge
  line_items.push({ item: "annual_plan", amount: plan.annual_price_paise });

  const total = line_items.reduce((sum, item) => sum + item.amount, 0);

  return {
    total,
    currency: "INR",
    line_items,
    plan_id: planId,
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
 * Get the appropriate plan code for subscriptions table based on plan_id.
 * Maps billing plan IDs to subscription plan codes.
 */
export function getSubscriptionPlanCode(planId: PlanId): "growth" | "pro" {
  // annual_500 -> growth (500 students)
  // annual_large -> pro (1000 students)
  return planId === "annual_500" ? "growth" : "pro";
}

/**
 * Test/live guard: refuse to run with live keys unless explicitly allowed.
 */
export function assertRazorpayKeyMode(keyId: string | undefined): void {
  if (!keyId) {
    throw new Error("RAZORPAY_KEY_ID is not set");
  }

  const isLive = keyId.startsWith("rzp_live_");
  const allowLive =
    process.env.RAZORPAY_ALLOW_LIVE?.toLowerCase() === "true";

  if (isLive && !allowLive) {
    throw new Error(
      "Refusing to use live Razorpay keys without RAZORPAY_ALLOW_LIVE=true",
    );
  }
}

/**
 * Server-side billing enabled flag.
 */
export function isBillingEnabled(): boolean {
  const disabled =
    process.env.BILLING_ENABLED?.toLowerCase() === "false" ||
    process.env.BILLING_DISABLED?.toLowerCase() === "true";
  return !disabled;
}
