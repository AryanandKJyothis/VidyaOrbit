/**
 * Razorpay in-app checkout pricing configuration (v1)
 * Server-only — never send these values to the client.
 */

export type BillingIntent = "activate" | "renew";

export type LineItem = {
  item: "setup_fee" | "annual_plan";
  amount: number; // paise
};

export type PricingResult = {
  total: number; // paise
  currency: string;
  line_items: LineItem[];
};

// ── Configuration (env-overridable) ──
const SETUP_FEE_PAISE = parseInt(
  process.env.BILLING_SETUP_FEE_PAISE ?? "500000", // ₹5,000
  10,
);
const ANNUAL_PLAN_PAISE = parseInt(
  process.env.BILLING_ANNUAL_PLAN_PAISE ?? "1000000", // ₹10,000
  10,
);
export const ANNUAL_PLAN_STUDENT_LIMIT = parseInt(
  process.env.BILLING_ANNUAL_PLAN_STUDENT_LIMIT ?? "500", // Growth tier
  10,
);

/**
 * Compute pricing for an intent.
 * @param intent 'activate' = first purchase (setup + annual), 'renew' = annual only
 * @param hasPaidSetup Whether the workspace has paid setup fee before (checked from billing_orders)
 */
export function computePricing(
  intent: BillingIntent,
  hasPaidSetup: boolean,
): PricingResult {
  const line_items: LineItem[] = [];

  // Setup fee only on first purchase if not already paid
  if (intent === "activate" && !hasPaidSetup) {
    line_items.push({ item: "setup_fee", amount: SETUP_FEE_PAISE });
  }

  // Annual plan charge
  line_items.push({ item: "annual_plan", amount: ANNUAL_PLAN_PAISE });

  const total = line_items.reduce((sum, item) => sum + item.amount, 0);

  return {
    total,
    currency: "INR",
    line_items,
  };
}

/**
 * Check if the workspace has ever paid a setup fee.
 */
export async function hasPaidSetupFee(
  ownerId: string,
  supabaseAdmin: any,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("billing_orders")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("status", "paid")
    .not("line_items", "is", null)
    .limit(1);

  if (!data || data.length === 0) return false;

  // Check if any paid order includes setup_fee
  const { data: orders } = await supabaseAdmin
    .from("billing_orders")
    .select("line_items")
    .eq("owner_id", ownerId)
    .eq("status", "paid");

  if (!orders) return false;

  return orders.some((order: any) => {
    const items = order.line_items;
    if (!Array.isArray(items)) return false;
    return items.some((item: any) => item.item === "setup_fee");
  });
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
