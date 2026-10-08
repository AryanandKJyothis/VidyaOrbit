/**
 * POST /api/billing/create-order
 * Create a Razorpay order for in-app checkout.
 * Server-side pricing only — client sends intent and workspace, server computes amount.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import Razorpay from "razorpay";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseBearerUserId } from "@/server/require-bearer-user";
import { allowRequest, clientAddress, tooManyRequests } from "@/lib/rate-limit";
import {
  computePricing,
  hasPaidSetupFee,
  assertRazorpayKeyMode,
  isBillingEnabled,
  isValidPlanId,
  type PlanId,
} from "@/lib/billing-pricing";

const bodySchema = z.object({
  plan_id: z.string().min(1),
});

export const Route = createFileRoute("/api/billing/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (
          !allowRequest(
            `billing-order:${clientAddress(request)}`,
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
              message: "Billing is not enabled on this deployment.",
            },
            { status: 503 },
          );
        }

        const keyId = process.env.RAZORPAY_KEY_ID?.trim();
        const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

        if (!keyId || !keySecret) {
          console.error("[create-order] Missing Razorpay credentials");
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
          console.error("[create-order]", String(e));
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

        // Validate plan_id
        if (!isValidPlanId(body.plan_id)) {
          return Response.json(
            {
              ok: false,
              code: "INVALID_PLAN",
              message: "Invalid plan ID. Must be 'annual_500' or 'annual_large'.",
            },
            { status: 400 },
          );
        }

        const planId = body.plan_id as PlanId;

        // Check that the user is the workspace owner
        const { data: inst, error: instErr } = await supabaseAdmin
          .from("institutes")
          .select("owner_id, name, contact_email")
          .eq("owner_id", userId)
          .maybeSingle();

        if (instErr || !inst) {
          console.error("[create-order] institute read error:", instErr);
          return Response.json(
            {
              ok: false,
              code: "OWNER_CHECK_FAILED",
              message: "Could not verify workspace ownership.",
            },
            { status: 500 },
          );
        }

        // Ensure the caller is the owner
        if (inst.owner_id !== userId) {
          return Response.json(
            {
              ok: false,
              code: "NOT_OWNER",
              message: "Only the workspace owner can purchase plans.",
            },
            { status: 403 },
          );
        }

        // Check if setup fee has been paid before
        const paidSetup = await hasPaidSetupFee(userId, supabaseAdmin);

        // Compute server-side pricing
        const pricing = computePricing(planId, paidSetup);

        // Create Razorpay order
        const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

        const receipt = `vidya_${planId}_${Date.now().toString(36)}`;
        const notes = {
          owner_id: userId,
          plan_id: planId,
        };

        let rzOrder: any;
        try {
          rzOrder = await rzp.orders.create({
            amount: pricing.total,
            currency: pricing.currency,
            receipt,
            notes,
          });
        } catch (e: any) {
          console.error("[create-order] Razorpay order creation failed:", e);
          return Response.json(
            {
              ok: false,
              code: "RAZORPAY_ERROR",
              message:
                e?.error?.description ||
                e?.message ||
                "Failed to create payment order.",
            },
            { status: 502 },
          );
        }

        // Store order in DB with plan_id
        const { error: insertErr } = await supabaseAdmin
          .from("billing_orders")
          .insert({
            owner_id: userId,
            razorpay_order_id: rzOrder.id,
            intent: planId, // Store plan_id as intent for now
            amount_paise: pricing.total,
            currency: pricing.currency,
            status: "created",
            line_items: pricing.line_items,
          });

        if (insertErr) {
          console.error("[create-order] DB insert failed:", insertErr);
          return Response.json(
            {
              ok: false,
              code: "DB_ERROR",
              message: "Could not record order.",
            },
            { status: 500 },
          );
        }

        return Response.json({
          ok: true,
          orderId: rzOrder.id,
          amount: pricing.total,
          currency: pricing.currency,
          keyId,
        });
      },
    },
  },
});
