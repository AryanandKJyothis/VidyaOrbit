/**
 * POST /api/billing/verify-payment
 * Verify Razorpay payment signature and activate subscription idempotently.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseBearerUserId } from "@/server/require-bearer-user";
import { allowRequest, clientAddress, tooManyRequests } from "@/lib/rate-limit";
import { assertRazorpayKeyMode, isBillingEnabled } from "@/lib/billing-pricing";
import { activateOrderOnce } from "@/lib/billing-activation";

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
        const rawBody = await request.json();
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

        // Verify signature
        const sigText = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSig = crypto
          .createHmac("sha256", keySecret)
          .update(sigText)
          .digest("hex");

        if (
          razorpay_signature.length !== expectedSig.length ||
          !crypto.timingSafeEqual(
            Buffer.from(razorpay_signature),
            Buffer.from(expectedSig),
          )
        ) {
          console.error("[verify-payment] Invalid signature");
          return Response.json(
            { ok: false, code: "INVALID_SIGNATURE", message: "Invalid signature." },
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

        if (orderErr || !order) {
          console.error("[verify-payment] Order not found:", orderErr);
          return Response.json(
            { ok: false, code: "ORDER_NOT_FOUND", message: "Order not found." },
            { status: 404 },
          );
        }

        // Fetch payment from Razorpay API to validate amount & currency
        const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
        let payment: any;

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

        // Validate payment matches order
        if (
          payment.status !== "captured" &&
          payment.status !== "authorized"
        ) {
          console.error("[verify-payment] Payment not captured:", payment.status);
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

        // Activate order idempotently
        const activation = await activateOrderOnce(
          supabaseAdmin,
          razorpay_order_id,
          razorpay_payment_id,
        );

        if (!activation.success) {
          if (activation.reason === "already_activated") {
            console.log("[verify-payment] Already activated, returning success");
            return Response.json({ ok: true, message: "Payment already processed" });
          }
          console.error("[verify-payment] Activation failed:", activation.reason);
          return Response.json(
            {
              ok: false,
              code: "ACTIVATION_FAILED",
              message: "Could not activate subscription.",
            },
            { status: 500 },
          );
        }

        console.log("[verify-payment] Successfully activated order:", activation.orderId);
        return Response.json({ ok: true });
      },
    },
  },
});
