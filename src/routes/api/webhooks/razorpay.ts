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

        let envelope: RzEnvelope;
        try {
          envelope = JSON.parse(rawBody) as RzEnvelope;
        } catch {
          return Response.json({ error: "BAD_JSON" }, { status: 400 });
        }

        const eventName = envelope.event ?? "";
        const payload = envelope.payload ?? {};

        // Extract payment entity (same location for both payment.captured and order.paid)
        const paymentEntity = payload.payment?.entity;
        const orderId =
          paymentEntity?.order_id ?? payload.order?.entity?.id ?? null;
        const paymentId = paymentEntity?.id ?? null;

        // Store minimal data (no PII)
        const minimalPayload = {
          event: eventName,
          payment: paymentEntity
            ? {
                id: paymentEntity.id,
                order_id: paymentEntity.order_id,
                amount: paymentEntity.amount,
                currency: paymentEntity.currency,
                status: paymentEntity.status,
                method: paymentEntity.method,
              }
            : null,
          order: payload.order?.entity?.id
            ? { id: payload.order.entity.id }
            : null,
        };

        // Upsert delivery record with ignoreDuplicates
        const { error: upsertErr } = await supabaseAdmin
          .from("razorpay_webhook_deliveries")
          .upsert(
            {
              delivery_hash: eventId,
              event_type: eventName,
              subscription_id: null,
              owner_id: normalizeOwner(paymentEntity?.notes?.owner_id),
              signature: sig ?? null,
              raw_body: minimalPayload,
              handled: false,
            },
            {
              onConflict: "delivery_hash",
              ignoreDuplicates: true,
            },
          );

        if (upsertErr) {
          console.error(
            "[Razorpay webhook] Upsert delivery failed:",
            upsertErr,
          );
          return Response.json({ error: "DB_UPSERT_FAILED" }, { status: 500 });
        }

        // Check if already handled
        const { data: delivery, error: deliveryErr } = await supabaseAdmin
          .from("razorpay_webhook_deliveries")
          .select("handled")
          .eq("delivery_hash", eventId)
          .single();

        if (deliveryErr) {
          console.error(
            "[Razorpay webhook] Delivery lookup failed:",
            deliveryErr,
          );
          return Response.json({ error: "DB_LOOKUP_FAILED" }, { status: 500 });
        }

        if (delivery?.handled) {
          console.log("[Razorpay webhook] Event already handled:", eventId);
          return Response.json({
            ok: true,
            ignored: true,
            reason: "already_handled",
          });
        }

        // Process event
        try {
          if (eventName === "payment.captured" || eventName === "order.paid") {
            if (!paymentEntity) {
              console.warn(
                "[Razorpay webhook] No payment entity in payload:",
                eventName,
              );
              return Response.json({ ok: true, ignored: true });
            }

            if (!orderId || !paymentId) {
              console.warn(
                "[Razorpay webhook] Missing order_id or payment_id:",
                { orderId, paymentId },
              );
              return Response.json({ ok: true, ignored: true });
            }

            // Only activate when status is captured
            if (paymentEntity.status !== "captured") {
              console.log(
                `[Razorpay webhook] Payment status ${paymentEntity.status}, not activating`,
              );
              return Response.json({
                ok: true,
                ignored: true,
                reason: "not_captured",
              });
            }

            // Find the order by razorpay_order_id
            const { data: order, error: orderErr } = await supabaseAdmin
              .from("billing_orders")
              .select("id, amount_paise, currency")
              .eq("razorpay_order_id", orderId)
              .maybeSingle();

            if (orderErr) {
              throw orderErr;
            }

            if (!order) {
              console.log(
                "[Razorpay webhook] Order not found (may be from another environment):",
                orderId,
              );
              return Response.json({
                ok: true,
                ignored: true,
                reason: "order_not_found",
              });
            }

            // Check amount and currency match
            if (
              paymentEntity.amount !== order.amount_paise ||
              paymentEntity.currency.toUpperCase() !==
                order.currency.toUpperCase()
            ) {
              console.error("[Razorpay webhook] Amount or currency mismatch:", {
                expected: {
                  amount: order.amount_paise,
                  currency: order.currency,
                },
                received: {
                  amount: paymentEntity.amount,
                  currency: paymentEntity.currency,
                },
              });
              // Return 200 but log as alert (don't retry)
              return Response.json({
                ok: true,
                ignored: true,
                reason: "amount_or_currency_mismatch",
              });
            }

            // Activate order idempotently
            const activation = await activateOrderOnce(
              supabaseAdmin,
              order.id,
              paymentId,
              paymentEntity.amount,
              paymentEntity.currency,
            );

            if (
              !activation.success &&
              activation.reason !== "already_activated" &&
              activation.reason !== "tier_change_needs_review"
            ) {
              // Throw to trigger retry (500)
              throw new Error(`Activation failed: ${activation.reason}`);
            }

            console.log(
              `[Razorpay webhook] ${activation.success ? "Activated" : "Already activated"} order ${orderId}`,
            );
          } else {
            // Ignore other events
            console.log("[Razorpay webhook] Ignoring event:", eventName);
          }
        } catch (e) {
          console.error("[Razorpay webhook] Handler error:", e);

          // Mark delivery with error (but don't mark as handled - allow retry)
          await supabaseAdmin
            .from("razorpay_webhook_deliveries")
            .update({ error: String(e) })
            .eq("delivery_hash", eventId);

          return Response.json({ error: "PROCESSING_FAILED" }, { status: 500 });
        }

        // Mark delivery as handled
        const { error: handledErr } = await supabaseAdmin
          .from("razorpay_webhook_deliveries")
          .update({ handled: true, handled_at: new Date().toISOString() })
          .eq("delivery_hash", eventId);

        if (handledErr) {
          console.error(
            "[Razorpay webhook] Failed to mark handled:",
            handledErr,
          );
          return Response.json({ error: "DB_UPDATE_FAILED" }, { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});

type RzEnvelope = {
  event?: string;
  payload?: {
    payment?: { entity?: PaymentEntity };
    order?: { entity?: OrderEntity };
    [key: string]: unknown;
  };
};

type PaymentEntity = {
  id: string;
  order_id?: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  notes?: {
    owner_id?: unknown;
    [key: string]: unknown;
  };
};

type OrderEntity = {
  id: string;
  payment_id?: string;
  first_payment_id?: string;
};

function normalizeOwner(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const id = v.trim();
  if (!id) return null;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id) ? id : null;
}
