/**
 * Razorpay webhook secret from server env. Checkout keys are read
 * directly in the billing routes so unused subscription-plan env is gone.
 */
export function getWebhookSecret(): string | undefined {
  const raw =
    typeof process !== "undefined"
      ? process.env.RAZORPAY_WEBHOOK_SECRET
      : undefined;
  const t = typeof raw === "string" ? raw.trim() : "";
  return t || undefined;
}
