import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";
import {
  billingNotConfiguredDetails,
  billingNotConfiguredReason,
  getOptionalRazorpayEnv,
  razorpayPlanIdFor,
  requireRazorpayEnv,
} from "@/lib/razorpay-env";
import { friendlyRazorpayError } from "@/lib/razorpay-errors";
import {
  rzCancelSubscription,
  rzCreateCustomer,
  rzCreateSubscription,
  rzGetPlan,
  rzGetSubscription,
} from "@/lib/razorpay-http";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseBearerUserId } from "@/server/require-bearer-user";
import {
  markCheckoutPending,
  resetCheckoutState,
} from "@/server/subscriptions-razorpay-sync";

const bodySchema = z.object({
  planCode: z.enum(["starter", "growth", "pro"]),
});

const CHECKOUT_LOCK_STATUSES = new Set(["pending_checkout", "processing_checkout"]);

export const Route = createFileRoute("/api/billing/start-subscription")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { BILLING_DISABLED } = await import("@/lib/feature-flags");
        if (BILLING_DISABLED) {
          return Response.json(
            { ok: false, code: "DISABLED", message: "Billing is temporarily disabled. Contact your administrator." },
            { status: 503 },
          );
        }
        const auth = await parseBearerUserId(request);
        if (!auth.ok) return auth.response;

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return Response.json(
            { ok: false, code: "BAD_REQUEST", message: "Invalid plan selection." },
            { status: 400 },
          );
        }

        if (!getOptionalRazorpayEnv().configured) {
          console.error("[billing/start-subscription]", billingNotConfiguredDetails());
          return Response.json(
            { ok: false, code: "NOT_CONFIGURED", message: billingNotConfiguredReason() },
            { status: 503 },
          );
        }

        const envCfg = requireRazorpayEnv();
        const userId = auth.userId;

        const { data: inst, error: instErr } = await supabaseAdmin
          .from("institutes")
          .select("contact_email,name")
          .eq("owner_id", userId)
          .maybeSingle();

        if (instErr) {
          console.error(instErr);
          return Response.json(
            { ok: false, code: "INSTITUTE_READ", message: "Could not load institute details." },
            { status: 500 },
          );
        }

        const email = typeof inst?.contact_email === "string" ? inst.contact_email.trim() : "";

        if (!email) {
          return Response.json(
            {
              ok: false,
              code: "MISSING_BILLING_EMAIL",
              message:
                "Add your institute contact email in Settings → Institute before subscribing.",
            },
            { status: 400 },
          );
        }

        const displayName =
          typeof inst?.name === "string" && inst.name.trim().length > 1
            ? inst.name.trim()
            : "Institute";

        const { data: subRow } = await supabaseAdmin
          .from("subscriptions")
          .select("*")
          .eq("owner_id", userId)
          .maybeSingle();

        const checkoutLocked =
          !!subRow?.status && CHECKOUT_LOCK_STATUSES.has(subRow.status);

        if (subRow?.razorpay_subscription_id) {
          try {
            await rzCancelSubscription(subRow.razorpay_subscription_id);
          } catch {
            /* already cancelled server-side — continue */
          }
        }

        if (checkoutLocked) {
          await resetCheckoutState(userId);
        }

        let customerId = subRow?.razorpay_customer_id ?? null;

        try {
          const planId = razorpayPlanIdFor(body.planCode, envCfg);

          try {
            const plan = await rzGetPlan(planId);
            if (plan.item?.active === false) {
              return Response.json(
                {
                  ok: false,
                  code: "PLAN_INACTIVE",
                  message:
                    "This subscription plan is inactive in Razorpay. Ask support to enable the plan in your Razorpay dashboard.",
                },
                { status: 502 },
              );
            }
          } catch (planErr) {
            console.error("[billing/start-subscription] plan validation failed:", planErr);
            return Response.json(
              {
                ok: false,
                code: "INVALID_PLAN",
                message:
                  "The selected plan is not available in Razorpay. Check that plan IDs match your Razorpay mode (test vs live).",
              },
              { status: 502 },
            );
          }

          if (!customerId) {
            const c = await rzCreateCustomer({
              email,
              name: displayName.slice(0, 120),
              ownerId: userId,
            });
            customerId = c.id;
          }

          const sub = await rzCreateSubscription({
            plan_id: planId,
            customer_id: customerId!,
            ownerId: userId,
            plan_code: body.planCode,
          });

          const okPersist = await markCheckoutPending(userId, customerId!, sub.id);
          if (!okPersist) {
            try {
              await rzCancelSubscription(sub.id);
            } catch (cancelErr) {
              console.error(
                "[billing/start-subscription] failed to persist pending checkout and rollback failed:",
                cancelErr,
              );
            }
            return Response.json(
              {
                ok: false,
                code: "PERSIST_PENDING",
                message: "Could not save checkout state. Please try again.",
              },
              { status: 500 },
            );
          }

          const fresh = await rzGetSubscription(sub.id);
          const rzStatus = (fresh.status ?? sub.status ?? "").toLowerCase();

          if (rzStatus && rzStatus !== "created") {
            await resetCheckoutState(userId);
            try {
              await rzCancelSubscription(sub.id);
            } catch {
              /* ignore */
            }
            return Response.json(
              {
                ok: false,
                code: "CHECKOUT_UNAVAILABLE",
                message:
                  "The payment page is not available for this subscription. Start checkout again — if it keeps failing, verify Razorpay plan IDs match your API keys (test vs live).",
              },
              { status: 502 },
            );
          }

          const shortUrl = fresh.short_url ?? sub.short_url ?? null;
          if (!shortUrl) {
            return Response.json(
              {
                ok: false,
                code: "MISSING_SHORT_URL",
                message:
                  "We could not open the Razorpay payment page. Confirm subscription plans are set up in Razorpay and try again.",
              },
              { status: 502 },
            );
          }

          return Response.json({ ok: true, short_url: shortUrl, razorpay_subscription_id: sub.id });
        } catch (e: unknown) {
          await resetCheckoutState(userId);
          console.error("[billing/start-subscription]", e);
          return Response.json(
            { ok: false, code: "RAZORPAY_ERROR", message: friendlyRazorpayError(e) },
            { status: 502 },
          );
        }
      },
    },
  },
});
