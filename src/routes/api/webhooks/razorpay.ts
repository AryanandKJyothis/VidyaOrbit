import { createFileRoute } from "@tanstack/react-router";
import { isBillingEnabled } from "@/lib/billing-pricing";
import { getWebhookSecret } from "@/lib/razorpay-env";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay-webhook-verify";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { allowRequest, clientAddress, tooManyRequests } from "@/lib/rate-limit";
import { activateOrderOnce } from "@/lib/billing-activation";

/**
 * POST /api/webhooks/razorpay
 * Razorpay webhook handler for payment events.
 * Backup activation path when verify-payment is not called.
 */

export const Route = createFileRoute("/api/webhooks/razorpay")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
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
          return Response.json({ error: "MISSING_EVENT_ID" }, { status: 400 });
        }

        // Check for duplicate event_id (dedupe on unique x-razorpay-event-id)
        const { data: existing } = await supabaseAdmin
          .from("razorpay_webhook_deliveries")
          .select("id, handled")
          .eq("delivery_hash", eventId)
          .maybeSingle();

        if (existing?.handled) {
          return Response.json({
            ok: true,
            ignored: true,
            reason: "already_handled",
          });
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
          deliveryRecord.owner_id = normalizeOwner(
            paymentEntity?.notes?.owner_id,
          );
        } else if (eventName === "order.paid" && payload.order) {
          const orderEntity = (payload.order as any).entity;
          orderId = orderEntity?.id ?? null;
          deliveryRecord.owner_id = normalizeOwner(
            orderEntity?.notes?.owner_id,
          );
        }

        // Insert delivery record
        const { error: insErr } = await supabaseAdmin
          .from("razorpay_webhook_deliveries")
          .insert({
            delivery_hash: eventId,
            event_type: eventName,
            subscription_id: null,
            owner_id: deliveryRecord.owner_id,
            signature: sig ?? null,
            raw_body: envelope,
            handled: false,
          });

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
          return Response.json({ error: "DB_INSERT_FAILED" }, { status: 500 });
        }

        // Process event
        try {
          if (eventName === "payment.captured" || eventName === "order.paid") {
            if (!orderId) {
              console.warn("[Razorpay webhook] No order_id in payload");
              return Response.json({ ok: true, ignored: true });
            }

            // Get payment_id for activation
            let paymentId: string | null = null;
            if (eventName === "payment.captured" && payload.payment) {
              paymentId = (payload.payment as { entity?: { id?: string } }).entity?.id ?? null;
            } else if (eventName === "order.paid" && payload.order) {
              // For order.paid, fetch the payment from the order
              const orderEntity = (payload.order as {
                entity?: { payment_id?: string; first_payment_id?: string };
              }).entity;
              paymentId =
                orderEntity?.payment_id ??
                orderEntity?.first_payment_id ??
                null;
            }

            if (!paymentId) {
              console.warn("[Razorpay webhook] No payment_id in payload");
              return Response.json({ ok: true, ignored: true });
            }

            // Activate order idempotently
            const activation = await activateOrderOnce(
              supabaseAdmin,
              orderId,
              paymentId,
            );

            if (
              !activation.success &&
              activation.reason !== "already_activated"
            ) {
              throw new Error(`Activation failed: ${activation.reason}`);
            }

            console.log(
              `[Razorpay webhook] ${activation.success ? "Activated" : "Already activated"} order ${orderId}`,
            );
          }
          // Ignore other events (legacy subscription events are deprecated)
        } catch (e) {
          console.error("[Razorpay webhook] Handler error:", e);

          // Mark delivery with error (but don't mark as handled - allow retry)
          await supabaseAdmin
            .from("razorpay_webhook_deliveries")
            .update({ error: String(e) })
            .eq("event_type", eventId);

          return Response.json({ error: "PROCESSING_FAILED" }, { status: 500 });
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
