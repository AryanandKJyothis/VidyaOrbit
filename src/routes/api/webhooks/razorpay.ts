import { createFileRoute } from "@tanstack/react-router";
import { BILLING_DISABLED } from "@/lib/feature-flags";
import { getWebhookSecret } from "@/lib/razorpay-env";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay-webhook-verify";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { allowRequest, clientAddress, tooManyRequests } from "@/lib/rate-limit";
import { createHash } from "node:crypto";
import {
  activatePaidSubscription,
  downgradeToFree,
  resolveSubscriptionOwnerId,
  type RzWebhookSubscriptionEntity,
} from "@/server/subscriptions-razorpay-sync";

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
        if (BILLING_DISABLED) {
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

        let envelope: RzEnvelope;
        try {
          envelope = JSON.parse(rawBody) as RzEnvelope;
        } catch {
          return Response.json({ error: "BAD_JSON" }, { status: 400 });
        }

        const payload = envelope.payload ?? {};
        const entity =
          typeof payload.subscription === "object" &&
          payload.subscription !== null &&
          "entity" in payload.subscription
            ? ((
                payload.subscription as { entity?: RzWebhookSubscriptionEntity }
              ).entity ?? null)
            : null;

        // Compute a stable delivery hash of the raw body + signature to dedupe deliveries
        const deliveryHash = createHash("sha256")
          .update(rawBody + "|" + (sig ?? ""))
          .digest("hex");

        // Check existing delivery record
        try {
          const { data: existing, error: existingErr } = await supabaseAdmin
            .from("razorpay_webhook_deliveries")
            .select("*")
            .eq("delivery_hash", deliveryHash)
            .maybeSingle();
          if (existingErr) {
            console.error(
              "[Razorpay webhook] failed reading deliveries table:",
              existingErr,
            );
            // continue — do not block processing solely on observability errors
          }
          if (existing?.handled) {
            // already processed
            return Response.json({ ok: true, ignored: true });
          }

          if (!existing) {
            // Insert a delivery row to record receipt (handled=false)
            try {
              const parsedJson = (() => {
                try {
                  return JSON.parse(rawBody);
                } catch {
                  return null;
                }
              })();
              const { error: insErr } = await supabaseAdmin
                .from("razorpay_webhook_deliveries")
                .insert({
                  delivery_hash: deliveryHash,
                  event_type: envelope.event ?? null,
                  subscription_id: entity?.id ?? null,
                  owner_id: normalizeOwner(
                    entity?.notes && typeof entity.notes === "object"
                      ? (entity.notes as Record<string, unknown>).owner_id
                      : null,
                  ),
                  signature: sig ?? null,
                  raw_body: parsedJson ?? null,
                });
              if (insErr) {
                console.error(
                  JSON.stringify({
                    event: "Razorpay webhook",
                    error: "failed to insert delivery",
                    details: insErr,
                  }),
                );
                if (insErr.code === "23505") {
                  return Response.json({
                    ok: true,
                    ignored: true,
                    reason: "concurrent_duplicate",
                  });
                }
              }
            } catch (e) {
              console.error(
                JSON.stringify({
                  event: "Razorpay webhook",
                  error: "insert delivery exception",
                  details: String(e),
                }),
              );
            }
          }
        } catch (e) {
          console.error("[Razorpay webhook] delivery table check error:", e);
        }

        const ownerResolved = await resolveSubscriptionOwnerId(entity);
        if (!entity?.id || !ownerResolved) {
          console.warn(
            "[Razorpay webhook] Missing subscription id or owner mapping",
            {
              event: envelope.event,
              subscriptionId: entity?.id,
            },
          );
          return Response.json({ ok: true, ignored: true });
        }

        const eventName = envelope.event ?? "";

        try {
          if (
            eventName === "subscription.authenticated" ||
            eventName === "subscription.activated" ||
            eventName === "subscription.charged" ||
            eventName === "subscription.resumed"
          ) {
            const activated = await activatePaidSubscription(
              entity,
              ownerResolved,
            );
            if (!activated) {
              console.error(
                "[Razorpay webhook] activatePaidSubscription failed",
                {
                  event: eventName,
                  subscriptionId: entity.id,
                  ownerId: ownerResolved,
                  plan_id: entity.plan_id,
                },
              );
              return new Response("", { status: 500 });
            }
          } else if (
            eventName === "subscription.halted" ||
            eventName === "subscription.cancelled" ||
            eventName === "subscription.paused" ||
            eventName === "subscription.completed"
          ) {
            await downgradeToFree(entity, ownerResolved);
          }
        } catch (e) {
          console.error(
            JSON.stringify({
              event: "Razorpay webhook",
              error: "Handler error",
              details: e instanceof Error ? e.message : String(e),
            }),
          );
          // mark delivery as handled with error to avoid endless retry storms; storing error for ops
          try {
            await supabaseAdmin
              .from("razorpay_webhook_deliveries")
              .update({
                handled: true,
                handled_at: new Date().toISOString(),
                error: String(e),
              })
              .eq(
                "delivery_hash",
                createHash("sha256")
                  .update(rawBody + "|" + (sig ?? ""))
                  .digest("hex"),
              );
          } catch (ee) {
            console.error(
              JSON.stringify({
                event: "Razorpay webhook",
                error: "failed marking delivery error",
                details: String(ee),
              }),
            );
          }
          return new Response("", { status: 500 });
        }

        // Mark delivery handled
        try {
          await supabaseAdmin
            .from("razorpay_webhook_deliveries")
            .update({ handled: true, handled_at: new Date().toISOString() })
            .eq("delivery_hash", deliveryHash);
        } catch (e) {
          console.error(
            "[Razorpay webhook] failed updating delivery handled flag:",
            e,
          );
        }

        return Response.json({ ok: true });
      },
    },
  },
});

type RzEnvelope = {
  event?: string;
  payload?: {
    subscription?: { entity?: RzWebhookSubscriptionEntity };
    payment?: Record<string, unknown>;
    invoice?: Record<string, unknown>;
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
