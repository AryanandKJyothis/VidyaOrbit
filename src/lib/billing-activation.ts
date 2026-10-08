/**
 * Shared activation logic for billing orders
 * Calls the atomic activate_billing_order RPC function
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ActivationResult =
  | {
      success: true;
      orderId: string;
      ownerId: string;
      tier: string;
      cycle: string;
      reason?: "setup_already_paid";
      needsReview?: boolean;
      reviewReason?: string | null;
    }
  | {
      success: false;
      reason:
        | "already_activated"
        | "order_not_found"
        | "amount_or_currency_mismatch"
        | "tier_change_needs_review"
        | "setup_already_paid"
        | "rpc_error";
      message?: string;
      needsReview?: boolean;
      reviewReason?: string | null;
    };

/**
 * Atomically mark an order as activated and extend subscription.
 * Returns success: true only if THIS call performed the activation.
 * Multiple calls with the same orderId will return already_activated.
 */
export async function activateOrderOnce(
  supabase: SupabaseClient<Database>,
  orderId: string,
  paymentId: string,
  amount: number,
  currency: string,
): Promise<ActivationResult> {
  const { data, error } = await supabase.rpc("activate_billing_order", {
    _order_id: orderId,
    _payment_id: paymentId,
    _amount: amount,
    _currency: currency,
  });

  if (error) {
    console.error("Activation RPC error:", error);
    return {
      success: false,
      reason: "rpc_error",
      message: error.message,
    };
  }

  if (!data) {
    return {
      success: false,
      reason: "rpc_error",
      message: "No data returned from activation RPC",
    };
  }

  // Parse the result
  const result = data as {
    activated: boolean;
    reason?: string;
    owner_id?: string;
    tier?: string;
    cycle?: string;
    needs_review?: boolean;
    review_reason?: string | null;
  };

  if (!result.activated) {
    const reason = (result.reason || "order_not_found") as
      | "already_activated"
      | "order_not_found"
      | "amount_or_currency_mismatch"
      | "tier_change_needs_review"
      | "setup_already_paid"
      | "rpc_error";
    const needsReview =
      result.needs_review === true ||
      result.reason === "tier_change_needs_review";
    return {
      success: false,
      reason,
      ...(needsReview ? { needsReview: true as const } : {}),
      ...(result.review_reason ? { reviewReason: result.review_reason } : {}),
    };
  }

  return {
    success: true,
    orderId: orderId,
    ownerId: result.owner_id || "",
    tier: result.tier || "",
    cycle: result.cycle || "",
    ...(result.reason === "setup_already_paid"
      ? { reason: "setup_already_paid" as const }
      : {}),
    ...(result.needs_review === true ? { needsReview: true } : {}),
    ...(result.review_reason ? { reviewReason: result.review_reason } : {}),
  };
}
