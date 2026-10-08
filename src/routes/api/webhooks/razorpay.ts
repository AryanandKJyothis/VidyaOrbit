import { createFileRoute } from "@tanstack/react-router";
import { isBillingEnabled } from "@/lib/billing-pricing";
import { getWebhookSecret } from "@/lib/razorpay-env";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay-webhook-verify";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { allowRequest, clientAddress, tooManyRequests } from "@/lib/rate-limit";

/**
 * Activate subscription idempotently from a paid order.
 * Used by both verify-payment and webhooks.
 */
async function activateFromOrder(
  orderId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: order } = await supabaseAdmin
    .from("billing_orders")
    .select("*")
    .eq("razorpay_order_id", orderId)
    .eq("status", "paid")
    .maybeSingle();

  if (!order) {
    return { ok: false, error: "Order not found or not paid" };
  }

  const { isValidTier, isValidCycle, getSubscriptionPlanCode } = await import(
    "@/lib/billing-pricing"
  );

  // Parse tier and cycle from stored intent
  const intentParts = order.intent.split("_");
  if (intentParts.length !== 2) {
    return { ok: false, error: `Invalid intent format: ${order.intent}` };
  }

  const [tier, cycle] = intentParts;

  if (!isValidTier(tier) || !isValidCycle(cycle)) {
    return { ok: false, error: `Invalid tier or cycle: ${tier}, ${cycle}` };
  }

  try {
    const { data: currentSub } = await supabaseAdmin
      .from("subscriptions")
      .select("expiry_date")
      .eq("owner_id", order.owner_id)
      .maybeSingle();

    const now = new Date();
    let baseDate = now;

    // Extend from current expiry if it's in the future
    if (currentSub?.expiry_date) {
      const currentExpiry = new Date(currentSub.expiry_date);
      if (currentExpiry > now) {
        baseDate = currentExpiry;
      }
    }

    // Add months based on cycle
    const monthsToAdd = cycle === "monthly" ? 1 : 12;
    const expiryDate = new Date(baseDate);
    expiryDate.setMonth(expiryDate.getMonth() + monthsToAdd);

    // Map tier to subscription plan code
    const planCode = getSubscriptionPlanCode(tier);

    const { error } = await supabaseAdmin.rpc(
      "apply_subscription_change" as never,
      {
        _owner: order.owner_id,
        _changed_by: order.owner_id,
        _plan: planCode,
        _status: "active",
        _start: now.toISOString(),
        _expiry: expiryDate.toISOString(),
        _price: null,
        _notes: `${tier} ${cycle} plan activated`,
        _note: `Razorpay payment: ${order.razorpay_payment_id ?? orderId}`,
        _confirm: true,
      } as never,
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export const Route = createFileRoute("/api/webhooks/razorpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (
          !allowRequest(
            `razorpay-webhook:${clientAddress(request)}`,
            60,
            60_000,
          )
        ) {
          return tooManyRequests();
        }
        if (!isBillingEnabled()) {
          return Response.json({ ok: false, disabled: true }, { status: 503 });
        }
        const secret = getWebhookSecret();
        if (!secret) {
          console.error("[Razorpay webhook] Missing RAZORPAY_WEBHOOK_SECRET");
          return new Response("", { status: 503 });
        }

        const rawBody = await request.text();
        const sig = request.headers.get("x-razorpay-signature");
        const okSig = await verifyRazorpayWebhookSignature(
          secret,
          rawBody,
          sig,
        );
        if (!okSig) {
          console.warn("[Razorpay webhook] Signature mismatch");
          return Response.json({ error: "BAD_SIGNATURE" }, { status: 400 });
        }

        // Dedupe using x-razorpay-event-id header (unique per event)
        const eventId = request.headers.get("x-razorpay-event-id");
        if (!eventId) {
          console.warn("[Razorpay webhook] Missing x-razorpay-event-id header");
          return Response.json(
            { error: "MISSING_EVENT_ID" },
            { status: 400 },
          );
        }

        // Check for duplicate event_id
        const { data: existing } = await supabaseAdmin
          .from("razorpay_webhook_deliveries")
          .select("id, handled")
          .eq("event_type", eventId)
          .maybeSingle();

        if (existing?.handled) {
          return Response.json({ ok: true, ignored: true, reason: "already_handled" });
        }

        let envelope: RzEnvelope;
        try {
          envelope = JSON.parse(rawBody) as RzEnvelope;
        } catch {
          return Response.json({ error: "BAD_JSON" }, { status: 400 });
        }

        const eventName = envelope.event ?? "";
        const payload = envelope.payload ?? {};

        // Insert or update delivery record
        const deliveryRecord = {
          delivery_hash: eventId,
          event_type: eventName,
          subscription_id: null as string | null,
          owner_id: null as string | null,
          signature: sig ?? null,
          raw_body: envelope,
          handled: false,
          received_at: new Date().toISOString(),
        };

        // Extract order_id from payload for payment.captured / order.paid
        let orderId: string | null = null;

        if (eventName === "payment.captured" && payload.payment) {
          const paymentEntity = (payload.payment as any).entity;
          orderId = paymentEntity?.order_id ?? null;
          deliveryRecord.owner_id = normalizeOwner(paymentEntity?.notes?.owner_id);
        } else if (eventName === "order.paid" && payload.order) {
          const orderEntity = (payload.order as any).entity;
          orderId = orderEntity?.id ?? null;
          deliveryRecord.owner_id = normalizeOwner(orderEntity?.notes?.owner_id);
        }

        // Insert delivery record
        const { error: insErr } = await supabaseAdmin
          .from("razorpay_webhook_deliveries")
          .insert(deliveryRecord);

        if (insErr) {
          if (insErr.code === "23505") {
            // Duplicate event_id
            return Response.json({
              ok: true,
              ignored: true,
              reason: "concurrent_duplicate",
            });
          }
          console.error("[Razorpay webhook] Insert delivery failed:", insErr);
          return Response.json(
            { error: "DB_INSERT_FAILED" },
            { status: 500 },
          );
        }

        // Process event
        try {
          if (eventName === "payment.captured" || eventName === "order.paid") {
            if (!orderId) {
              console.warn("[Razorpay webhook] No order_id in payload");
              return Response.json({ ok: true, ignored: true });
            }

            // Activate subscription from the paid order
            const result = await activateFromOrder(orderId);

            if (!result.ok) {
              throw new Error(result.error || "Activation failed");
            }
          }
          // Ignore other events (legacy subscription events are deprecated)
        } catch (e) {
          console.error("[Razorpay webhook] Handler error:", e);
          
          // Mark delivery with error (but don't mark as handled - allow retry)
          await supabaseAdmin
            .from("razorpay_webhook_deliveries")
            .update({ error: String(e) })
            .eq("event_type", eventId);

          return Response.json(
            { error: "PROCESSING_FAILED" },
            { status: 500 },
          );
        }

        // Mark delivery as handled
        await supabaseAdmin
          .from("razorpay_webhook_deliveries")
          .update({ handled: true, handled_at: new Date().toISOString() })
          .eq("event_type", eventId);

        return Response.json({ ok: true });
      },
    },
  },
});

type RzEnvelope = {
  event?: string;
  payload?: {
    payment?: { entity?: any };
    order?: { entity?: any };
    [key: string]: any;
  };
};

function normalizeOwner(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const id = v.trim();
  if (!id) return null;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id) ? id : null;
}
