/** Map Razorpay / billing failures to user-safe copy (never expose raw API bodies). */
export function friendlyRazorpayError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");

  if (/hosted page is not available/i.test(msg)) {
    return "The Razorpay payment page is no longer available. Start checkout again from Billing.";
  }
  if (/plan.*(not found|does not exist|invalid)/i.test(msg) || /no such plan/i.test(msg)) {
    return "This plan is not configured correctly in Razorpay. Please contact support.";
  }
  if (/401|authentication failed|unauthorized/i.test(msg)) {
    return "Payment provider credentials are invalid. Please contact support.";
  }
  if (/429|too many requests/i.test(msg)) {
    return "Payment provider is busy. Please wait a moment and try again.";
  }
  if (/short_url|checkout url/i.test(msg)) {
    return "We could not open the payment page. Please try checkout again.";
  }

  return "We could not complete checkout right now. Please try again in a few minutes.";
}
