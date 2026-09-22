/**
 * Razorpay + billing configuration from environment variables.
 * Add secrets in Lovable Secrets / `.env.local` — never expose KEY_SECRET or WEBHOOK_SECRET to the client.
 */
export type RazorpayEnv = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  plans: Record<SubscribablePlanEnvKey, string>;
};

export type SubscribablePlanEnvKey = "starter" | "growth" | "pro";

const PLAN_ENV_KEYS: Record<SubscribablePlanEnvKey, string> = {
  starter: "RAZORPAY_PLAN_STARTER",
  growth: "RAZORPAY_PLAN_GROWTH",
  pro: "RAZORPAY_PLAN_PRO",
};

export function getOptionalRazorpayEnv(): Partial<RazorpayEnv> & { configured: boolean } {
  const keyId = trimEnv("RAZORPAY_KEY_ID");
  const keySecret = trimEnv("RAZORPAY_KEY_SECRET");
  const webhookSecret = trimEnv("RAZORPAY_WEBHOOK_SECRET");
  const plans = {
    starter: trimEnv(PLAN_ENV_KEYS.starter) ?? "",
    growth: trimEnv(PLAN_ENV_KEYS.growth) ?? "",
    pro: trimEnv(PLAN_ENV_KEYS.pro) ?? "",
  };

  const allHaveValues =
    !!keyId && !!keySecret && !!webhookSecret && !!plans.starter && !!plans.growth && !!plans.pro;

  if (!allHaveValues)
    return {
      configured: false,
      keyId: keyId ?? "",
      keySecret: keySecret ?? "",
      webhookSecret: webhookSecret ?? "",
      plans,
    };

  return {
    configured: true,
    keyId: keyId!,
    keySecret: keySecret!,
    webhookSecret: webhookSecret!,
    plans,
  };
}

export function requireRazorpayEnv(): RazorpayEnv {
  const v = getOptionalRazorpayEnv();
  if (!v.configured) {
    const missing = buildMissingEnvList();
    throw new Error(
      `Razorpay is not configured. Set these secrets in Lovable Secrets or your deployment env:\n${missing.join("\n")}`,
    );
  }
  return v as RazorpayEnv;
}

export function billingNotConfiguredReason(): string {
  return "Online billing is not configured for this deployment yet. Please contact support.";
}

/** Server logs / ops only — lists missing secret names. */
export function billingNotConfiguredDetails(): string {
  const missing = buildMissingEnvList();
  return missing.length
    ? `Missing Razorpay env: ${missing.join(", ")}`
    : "Razorpay env incomplete";
}

/** Used by webhooks independently of whether checkout keys are wired yet. */
export function getWebhookSecret(): string | undefined {
  return trimEnv("RAZORPAY_WEBHOOK_SECRET");
}

function trimEnv(key: string): string | undefined {
  const raw = typeof process !== "undefined" ? process.env[key] : undefined;
  const t = typeof raw === "string" ? raw.trim() : "";
  return t || undefined;
}

function buildMissingEnvList(): string[] {
  const need = [
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "RAZORPAY_PLAN_STARTER",
    "RAZORPAY_PLAN_GROWTH",
    "RAZORPAY_PLAN_PRO",
  ];
  return need.filter((k) => !trimEnv(k));
}

export function razorpayPlanIdFor(plan: SubscribablePlanEnvKey, env?: RazorpayEnv): string {
  const e = env ?? requireRazorpayEnv();
  return e.plans[plan];
}

export function planFromRazorpayPlanId(planId: string): SubscribablePlanEnvKey | null {
  try {
    const e = requireRazorpayEnv();
    const entries = Object.entries(e.plans) as [SubscribablePlanEnvKey, string][];
    for (const [code, pid] of entries) if (pid === planId) return code;
    return null;
  } catch {
    return null;
  }
}
