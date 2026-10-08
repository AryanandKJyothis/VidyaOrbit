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
  hasAnyPaidOrder,
  assertRazorpayKeyMode,
  isBillingEnabled,
  isValidTier,
  isValidCycle,
  getTierConfig,
  type PlanTier,
  type BillingCycle,
} from "@/lib/billing-pricing";

const bodySchema = z.object({
  tier: z.string().min(1),
  cycle: z.string().min(1),
});

export const Route = createFileRoute("/api/billing/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (
          !allowRequest(`billing-order:${clientAddress(request)}`, 10, 60_000)
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

        // Validate tier and cycle
        if (!isValidTier(body.tier)) {
          return Response.json(
            {
              ok: false,
              code: "INVALID_TIER",
              message: "Invalid tier. Must be 'starter', 'growth', or 'large'.",
            },
            { status: 400 },
          );
        }

        if (!isValidCycle(body.cycle)) {
          return Response.json(
            {
              ok: false,
              code: "INVALID_CYCLE",
              message: "Invalid cycle. Must be 'monthly' or 'annual'.",
            },
            { status: 400 },
          );
        }

        const tier = body.tier as PlanTier;
        const cycle = body.cycle as BillingCycle;

        // Check for comped or special accounts (but allow free plan to upgrade)
        const { data: sub, error: subErr } = await supabaseAdmin
          .from("subscriptions")
          .select("plan, plan_price, notes, expiry_date")
          .eq("owner_id", userId)
          .maybeSingle();

        if (subErr) {
          console.error("[create-order] subscription read error:", subErr);
          return Response.json(
            {
              ok: false,
              code: "DB_ERROR",
              message: "Could not verify subscription status.",
            },
            { status: 500 },
          );
        }

        // Only block if it's a comped NON-FREE account
        // (free plan with NULL expiry/price is normal and should be allowed to buy)
        if (sub && sub.plan !== "free") {
          if (sub.plan_price === 0) {
            return Response.json(
              {
                ok: false,
                code: "COMPED_ACCOUNT",
                message:
                  "Your account has a complimentary plan. Please contact support to make changes.",
              },
              { status: 400 },
            );
          }
          if (sub.expiry_date === null) {
            return Response.json(
              {
                ok: false,
                code: "NO_EXPIRY_ACCOUNT",
                message:
                  "Your account has a special no-expiry plan. Please contact support to make changes.",
              },
              { status: 400 },
            );
          }
        }

        // Check that the user is the workspace owner
        const { data: inst, error: instErr } = await supabaseAdmin
          .from("institutes")
          .select("owner_id, name, contact_email")
          .eq("owner_id", userId)
          .maybeSingle();

        if (instErr) {
          console.error("[create-order] institute read error:", instErr);
          return Response.json(
            {
              ok: false,
              code: "DB_ERROR",
              message: "Could not verify workspace ownership.",
            },
            { status: 500 },
          );
        }

        if (!inst) {
          // No institute = not an owner (expected for team-joined users)
          return Response.json(
            {
              ok: false,
              code: "NOT_OWNER",
              message: "Only workspace owners can purchase plans.",
            },
            { status: 403 },
          );
        }

        // Check student count to prevent over-limit purchases (except for large = unlimited)
        if (tier !== "large") {
          const tierConfig = getTierConfig(tier);
          const { count: studentCount, error: countErr } = await supabaseAdmin
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", userId)
            .neq("status", "archived");

          if (countErr) {
            console.error("[create-order] student count error:", countErr);
            return Response.json(
              {
                ok: false,
                code: "DB_ERROR",
                message: "Could not verify student count.",
              },
              { status: 500 },
            );
          }

          if ((studentCount ?? 0) > tierConfig.student_limit) {
            return Response.json(
              {
                ok: false,
                code: "OVER_TIER_LIMIT",
                message: `You have ${studentCount} active students, but ${tier} tier supports only ${tierConfig.student_limit}. Please archive some students or choose a higher tier.`,
              },
              { status: 409 },
            );
          }
        }

        // Check if any paid order exists (for setup fee logic)
        let hasPriorPaidOrder: boolean;
        try {
          hasPriorPaidOrder = await hasAnyPaidOrder(userId, supabaseAdmin);
        } catch (e) {
          console.error("[create-order] hasAnyPaidOrder error:", e);
          return Response.json(
            {
              ok: false,
              code: "DB_ERROR",
              message: "Could not verify payment history.",
            },
            { status: 500 },
          );
        }

        // Compute server-side pricing
        const pricing = computePricing(tier, cycle, hasPriorPaidOrder);

        // Create Razorpay order
        const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

        const receipt = `vidya_${tier}_${cycle}_${Date.now().toString(36)}`;
        const notes = {
          owner_id: userId,
          tier,
          cycle,
        };

        let rzOrder: Razorpay.Orders.RazorpayOrder;
        try {
          rzOrder = await rzp.orders.create({
            amount: pricing.total,
            currency: pricing.currency,
            receipt,
            notes,
          });
        } catch (e) {
          console.error("[create-order] Razorpay order creation failed:", e);
          return Response.json(
            {
              ok: false,
              code: "RAZORPAY_ERROR",
              message: "Failed to create payment order. Please try again.",
            },
            { status: 502 },
          );
        }

        // Store order in DB with tier and cycle
        const { error: insertErr } = await supabaseAdmin
          .from("billing_orders")
          .insert({
            owner_id: userId,
            razorpay_order_id: rzOrder.id,
            intent: `${tier}_${cycle}`, // Store as "tier_cycle"
            tier,
            cycle,
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
