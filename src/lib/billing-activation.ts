/**
 * Shared activation logic for billing orders
 * Ensures idempotent activation via conditional update on activated_at
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Json = Database["public"]["Tables"]["billing_orders"]["Row"]["line_items"];

export type ActivationResult =
  | { success: true; orderId: string; ownerId: string; intent: Json }
  | { success: false; reason: "already_activated" | "order_not_found" | "not_paid" };

/**
 * Atomically mark an order as activated and extend subscription.
 * Returns success: true only if THIS call performed the activation.
 * Multiple calls with the same orderId will return already_activated.
 */
export async function activateOrderOnce(
  supabase: SupabaseClient<Database>,
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<ActivationResult> {
  // Conditional update: only activate if activated_at IS NULL
  const { data: updated, error } = await supabase
    .from("billing_orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      activated_at: new Date().toISOString(),
      razorpay_payment_id: razorpayPaymentId,
    })
    .eq("razorpay_order_id", razorpayOrderId)
    .is("activated_at", null)
    .select("id, owner_id, intent")
    .single();

  if (error || !updated) {
    // Check why: was it already activated, or does the order not exist?
    const { data: existing } = await supabase
      .from("billing_orders")
      .select("activated_at, status")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();

    if (!existing) {
      return { success: false, reason: "order_not_found" };
    }
    if (existing.activated_at !== null) {
      return { success: false, reason: "already_activated" };
    }
    return { success: false, reason: "not_paid" };
  }

  // This call won the race: activate subscription now
  const intent = updated.intent as Json;
  await supabase.rpc("apply_subscription_change" as never, {
    _uid: updated.owner_id,
    _change: intent,
  } as never);

  return {
    success: true,
    orderId: updated.id,
    ownerId: updated.owner_id,
    intent,
  };
}
