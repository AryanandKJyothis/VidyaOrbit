/**
 * POST /api/billing/verify-payment
 * Verify Razorpay payment signature and activate subscription.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseBearerUserId } from "@/server/require-bearer-user";
import { allowRequest, clientAddress, tooManyRequests } from "@/lib/rate-limit";
import {
  assertRazorpayKeyMode,
  isBillingEnabled,
  ANNUAL_PLAN_STUDENT_LIMIT,
} from "@/lib/billing-pricing";

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/**
 * Activate the subscription via apply_subscription_change RPC.
 * Sets the plan to Growth (500 students) with 365-day expiry from max(now, current_expiry).
 */
async function activateSubscription(
  ownerId: string,
  intent: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Get current subscription if exists
    const { data: currentSub } = await supabaseAdmin
      .from("subscriptions")
      .select("expiry_date")
      .eq("owner_id", ownerId)
      .maybeSingle();

    const now = new Date();
    let baseDate = now;

    // If renewing and current expiry is in the future, extend from there
    if (intent === "renew" && currentSub?.expiry_date) {
      const currentExpiry = new Date(currentSub.expiry_date);
      if (currentExpiry > now) {
        baseDate = currentExpiry;
      }
    }

    // Add 365 days
    const expiryDate = new Date(baseDate);
    expiryDate.setDate(expiryDate.getDate() + 365);

    const { data: result, error } = await supabaseAdmin.rpc(
      "apply_subscription_change" as never,
      {
        _owner: ownerId,
        _changed_by: ownerId,
        _plan: "growth", // Annual plan = Growth tier (500 students)
        _status: "active",
        _start: now.toISOString(),
        _expiry: expiryDate.toISOString(),
        _price: null, // Price is in billing_orders, not subscriptions
        _notes: `Annual plan activated via ${intent}`,
        _note: `Razorpay checkout: ${intent}`,
        _confirm: true,
      } as never,
    );

    if (error) {
      console.error("[verify-payment] RPC error:", error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e) {
    console.error("[verify-payment] Activation error:", e);
    return { ok: false, error: String(e) };
  }
}

export const Route = createFileRoute("/api/billing/verify-payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (
          !allowRequest(
            `billing-verify:${clientAddress(request)}`,
            10,
            60_000,
          )
        ) {
          return tooManyRequests();
        }

        if (!isBillingEnabled()) {
          return Response.json(
            {
              ok: false,
              code: "BILLING_DISABLED",
              message: "Billing is not enabled.",
            },
            { status: 503 },
          );
        }

        const keyId = process.env.RAZORPAY_KEY_ID?.trim();
        const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

        if (!keyId || !keySecret) {
          console.error("[verify-payment] Missing Razorpay credentials");
          return Response.json(
            {
              ok: false,
              code: "NOT_CONFIGURED",
              message: "Payment system is not configured.",
            },
            { status: 503 },
          );
        }

        try {
          assertRazorpayKeyMode(keyId);
        } catch (e) {
          console.error("[verify-payment]", String(e));
          return Response.json(
            {
              ok: false,
              code: "LIVE_KEY_BLOCKED",
              message: String(e),
            },
            { status: 403 },
          );
        }

        const auth = await parseBearerUserId(request);
        if (!auth.ok) return auth.response;

        const userId = auth.userId;

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return Response.json(
            {
              ok: false,
              code: "BAD_REQUEST",
              message: "Invalid request body.",
            },
            { status: 400 },
          );
        }

        // Verify signature (with length check before timingSafeEqual)
        const expectedSignature = crypto
          .createHmac("sha256", keySecret)
          .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
          .digest("hex");

        if (expectedSignature.length !== body.razorpay_signature.length) {
          return Response.json(
            {
              ok: false,
              code: "INVALID_SIGNATURE",
              message: "Payment verification failed.",
            },
            { status: 400 },
          );
        }

        const isValid = crypto.timingSafeEqual(
          Buffer.from(expectedSignature),
          Buffer.from(body.razorpay_signature),
        );

        if (!isValid) {
          console.warn("[verify-payment] Signature mismatch");
          return Response.json(
            {
              ok: false,
              code: "INVALID_SIGNATURE",
              message: "Payment verification failed.",
            },
            { status: 400 },
          );
        }

        // Load the stored order
        const { data: order, error: orderErr } = await supabaseAdmin
          .from("billing_orders")
          .select("*")
          .eq("razorpay_order_id", body.razorpay_order_id)
          .maybeSingle();

        if (orderErr || !order) {
          console.error("[verify-payment] Order not found:", orderErr);
          return Response.json(
            {
              ok: false,
              code: "ORDER_NOT_FOUND",
              message: "Order not found.",
            },
            { status: 404 },
          );
        }

        // Verify ownership
        if (order.owner_id !== userId) {
          return Response.json(
            {
              ok: false,
              code: "OWNERSHIP_MISMATCH",
              message: "Order does not belong to you.",
            },
            { status: 403 },
          );
        }

        // Fetch payment from Razorpay to confirm status and amount
        const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
        let payment: any;
        try {
          payment = await rzp.payments.fetch(body.razorpay_payment_id);
        } catch (e: any) {
          console.error("[verify-payment] Razorpay fetch failed:", e);
          return Response.json(
            {
              ok: false,
              code: "RAZORPAY_ERROR",
              message: "Could not verify payment with Razorpay.",
            },
            { status: 502 },
          );
        }

        // Check payment status
        if (payment.status !== "captured" && payment.status !== "authorized") {
          return Response.json(
            {
              ok: false,
              code: "PAYMENT_NOT_CAPTURED",
              message: `Payment status is ${payment.status}.`,
            },
            { status: 400 },
          );
        }

        // Check amount matches
        if (payment.amount !== order.amount_paise) {
          console.error(
            `[verify-payment] Amount mismatch: expected ${order.amount_paise}, got ${payment.amount}`,
          );
          return Response.json(
            {
              ok: false,
              code: "AMOUNT_MISMATCH",
              message: "Payment amount does not match order.",
            },
            { status: 400 },
          );
        }

        // Mark order as paid (idempotent conditional update)
        const { data: updateResult, error: updateErr } = await supabaseAdmin
          .from("billing_orders")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            razorpay_payment_id: body.razorpay_payment_id,
          })
          .eq("razorpay_order_id", body.razorpay_order_id)
          .eq("status", "created")
          .select("id")
          .maybeSingle();

        if (updateErr) {
          console.error("[verify-payment] Update failed:", updateErr);
          return Response.json(
            {
              ok: false,
              code: "UPDATE_FAILED",
              message: "Could not update order status.",
            },
            { status: 500 },
          );
        }

        // If updateResult is null, order was already marked paid (idempotent)
        const alreadyPaid = !updateResult;

        if (!alreadyPaid) {
          // Activate subscription
          const activationResult = await activateSubscription(
            userId,
            order.intent,
          );

          if (!activationResult.ok) {
            return Response.json(
              {
                ok: false,
                code: "ACTIVATION_FAILED",
                message:
                  activationResult.error || "Could not activate subscription.",
              },
              { status: 500 },
            );
          }
        }

        return Response.json({
          ok: true,
          paymentId: body.razorpay_payment_id,
          orderId: body.razorpay_order_id,
          alreadyPaid,
        });
      },
    },
  },
});
