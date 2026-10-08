/**
 * POST /api/billing/verify-payment
 * Verify Razorpay payment signature and activate subscription idempotently.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import Razorpay from "razorpay";
import type { Payments } from "razorpay/dist/types/payments";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseBearerUserId } from "@/server/require-bearer-user";
import { allowRequest, clientAddress, tooManyRequests } from "@/lib/rate-limit";
import { assertRazorpayKeyMode, isBillingEnabled } from "@/lib/billing-pricing";
import { activateOrderOnce } from "@/lib/billing-activation";
import { verifyCheckoutSignature } from "@/lib/billing-signature";
import {
  heldPaymentMessage,
  isSetupRefundReview,
  SETUP_ALREADY_PAID_MESSAGE,
} from "@/lib/billing-guards";

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const Route = createFileRoute("/api/billing/verify-payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (
          !allowRequest(`billing-verify:${clientAddress(request)}`, 10, 60_000)
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
              message: "Payment system not configured.",
            },
            { status: 503 },
          );
        }

        try {
          assertRazorpayKeyMode(keyId);
        } catch (e) {
          console.error("[verify-payment]", String(e));
          return Response.json(
            { ok: false, code: "LIVE_KEY_BLOCKED", message: String(e) },
            { status: 403 },
          );
        }

        const authResult = await parseBearerUserId(request);
        if (!authResult.ok) {
          return authResult.response;
        }
        const userId = authResult.userId;

        // Parse and validate body
        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return Response.json(
            {
              ok: false,
              code: "INVALID_JSON",
              message: "Malformed JSON in request body.",
            },
            { status: 400 },
          );
        }

        const parsed = bodySchema.safeParse(rawBody);

        if (!parsed.success) {
          return Response.json(
            {
              ok: false,
              code: "INVALID_BODY",
              message: "Missing or invalid payment fields.",
            },
            { status: 400 },
          );
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
          parsed.data;

        if (
          !verifyCheckoutSignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            keySecret,
          )
        ) {
          console.error("[verify-payment] Invalid signature");
          return Response.json(
            {
              ok: false,
              code: "INVALID_SIGNATURE",
              message: "Invalid signature.",
            },
            { status: 400 },
          );
        }

        // Fetch order from DB
        const { data: order, error: orderErr } = await supabaseAdmin
          .from("billing_orders")
          .select("*")
          .eq("razorpay_order_id", razorpay_order_id)
          .eq("owner_id", userId)
          .maybeSingle();

        if (orderErr) {
          console.error("[verify-payment] Order lookup error:", orderErr);
          return Response.json(
            {
              ok: false,
              code: "DB_ERROR",
              message: "Could not look up order.",
            },
            { status: 500 },
          );
        }

        if (!order) {
          console.error("[verify-payment] Order not found");
          return Response.json(
            { ok: false, code: "ORDER_NOT_FOUND", message: "Order not found." },
            { status: 404 },
          );
        }

        // Fetch payment from Razorpay API to validate amount & currency
        const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
        let payment: Payments.RazorpayPayment;

        try {
          payment = await rzp.payments.fetch(razorpay_payment_id);
        } catch (e) {
          console.error("[verify-payment] Razorpay API error:", e);
          return Response.json(
            {
              ok: false,
              code: "RAZORPAY_API_ERROR",
              message: "Could not fetch payment from Razorpay.",
            },
            { status: 500 },
          );
        }

        // Defense in depth: verify payment.order_id matches
        if (payment.order_id !== razorpay_order_id) {
          console.error(
            `[verify-payment] Order ID mismatch: expected ${razorpay_order_id}, got ${payment.order_id}`,
          );
          return Response.json(
            {
              ok: false,
              code: "ORDER_ID_MISMATCH",
              message: "Payment order ID does not match.",
            },
            { status: 400 },
          );
        }

        // Only activate when status is 'captured'
        if (payment.status === "authorized") {
          console.log(
            "[verify-payment] Payment authorized but not captured, returning pending",
          );
          return Response.json(
            {
              ok: true,
              status: "pending",
              message:
                "Payment authorized. Activation will complete when webhook confirms capture.",
            },
            { status: 200 },
          );
        }

        if (payment.status !== "captured") {
          console.error(
            "[verify-payment] Payment not captured:",
            payment.status,
          );
          return Response.json(
            {
              ok: false,
              code: "PAYMENT_NOT_CAPTURED",
              message: "Payment not captured.",
            },
            { status: 400 },
          );
        }

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

        if (payment.currency.toUpperCase() !== order.currency.toUpperCase()) {
          console.error(
            `[verify-payment] Currency mismatch: expected ${order.currency}, got ${payment.currency}`,
          );
          return Response.json(
            {
              ok: false,
              code: "CURRENCY_MISMATCH",
              message: "Payment currency does not match order.",
            },
            { status: 400 },
          );
        }

        // Activate order idempotently with fetched payment details
        const activation = await activateOrderOnce(
          supabaseAdmin,
          order.id,
          razorpay_payment_id,
          payment.amount,
          payment.currency,
        );

        if (!activation.success) {
          const orderFlags = order as {
            needs_review?: boolean | null;
            review_reason?: string | null;
          };
          const reviewReason =
            activation.reviewReason ?? orderFlags.review_reason;
          const held =
            activation.needsReview === true ||
            activation.reason === "tier_change_needs_review" ||
            Boolean(orderFlags.needs_review);
          if (held) {
            const setupRefund = isSetupRefundReview(reviewReason);
            console.warn(
              "[verify-payment] Paid order held for admin review:",
              order.id,
            );
            return Response.json({
              ok: true,
              needsReview: true,
              ...(setupRefund ? { setupRefund: true } : {}),
              message: heldPaymentMessage(reviewReason),
            });
          }
          if (activation.reason === "already_activated") {
            // Dismissed hold: review_reason remains, plan was never switched.
            // Do not let checkout toast "Your plan is now active".
            if (orderFlags.review_reason) {
              return Response.json({
                ok: true,
                alreadyProcessed: true,
                message: "Payment already processed",
              });
            }
            console.log(
              "[verify-payment] Already activated, returning success",
            );
            return Response.json({
              ok: true,
              message: "Payment already processed",
            });
          }
          console.error(
            "[verify-payment] Activation failed:",
            activation.reason,
          );
          return Response.json(
            {
              ok: false,
              code: "ACTIVATION_FAILED",
              message: "Could not activate subscription.",
            },
            { status: 500 },
          );
        }

        console.log(
          "[verify-payment] Successfully activated order:",
          activation.orderId,
        );
        if (
          activation.reason === "setup_already_paid" ||
          (activation.needsReview &&
            isSetupRefundReview(activation.reviewReason))
        ) {
          return Response.json({
            ok: true,
            needsReview: true,
            setupRefund: true,
            message: SETUP_ALREADY_PAID_MESSAGE,
          });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
