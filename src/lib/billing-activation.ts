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
    }
  | {
      success: false;
      reason:
        | "already_activated"
        | "order_not_found"
        | "amount_or_currency_mismatch"
        | "tier_change_needs_review"
        | "rpc_error";
      message?: string;
      needsReview?: boolean;
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
  };

  if (!result.activated) {
    const reason = (result.reason || "order_not_found") as
      | "already_activated"
      | "order_not_found"
      | "amount_or_currency_mismatch"
      | "tier_change_needs_review"
      | "rpc_error";
    const needsReview =
      result.needs_review === true ||
      result.reason === "tier_change_needs_review";
    return needsReview
      ? { success: false, reason, needsReview: true }
      : { success: false, reason };
  }

  return {
    success: true,
    orderId: orderId,
    ownerId: result.owner_id || "",
    tier: result.tier || "",
    cycle: result.cycle || "",
  };
}
