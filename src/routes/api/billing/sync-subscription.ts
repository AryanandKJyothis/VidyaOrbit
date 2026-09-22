import { createFileRoute } from "@tanstack/react-router";
import { getOptionalRazorpayEnv } from "@/lib/razorpay-env";
import { friendlyRazorpayError } from "@/lib/razorpay-errors";
import { rzGetSubscription } from "@/lib/razorpay-http";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseBearerUserId } from "@/server/require-bearer-user";
import {
  reconcileSubscriptionWithRazorpay,
  resetCheckoutState,
} from "@/server/subscriptions-razorpay-sync";

export const Route = createFileRoute("/api/billing/sync-subscription")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { BILLING_DISABLED } = await import("@/lib/feature-flags");
        if (BILLING_DISABLED) {
          return Response.json(
            { ok: false, code: "DISABLED", message: "Billing is temporarily disabled." },
            { status: 503 },
          );
        }
        const auth = await parseBearerUserId(request);
        if (!auth.ok) return auth.response;

        if (!getOptionalRazorpayEnv().configured) {
          return Response.json(
            { ok: false, code: "NOT_CONFIGURED", message: "Billing is not configured yet." },
            { status: 503 },
          );
        }

        const userId = auth.userId;

        const { data: subRow, error } = await supabaseAdmin
          .from("subscriptions")
          .select("plan, status, razorpay_subscription_id")
          .eq("owner_id", userId)
          .maybeSingle();

        if (error) {
          console.error("[billing/sync-subscription]", error);
          return Response.json(
            { ok: false, code: "READ_FAILED", message: "Could not read subscription." },
            { status: 500 },
          );
        }

        if (!subRow?.razorpay_subscription_id) {
          if (subRow?.status === "processing_checkout") {
            await resetCheckoutState(userId);
          }
          return Response.json({
            ok: true,
            plan: subRow?.plan ?? "free",
            status: subRow?.status === "processing_checkout" ? "active" : (subRow?.status ?? "active"),
            razorpay_status: null,
            synced: true,
          });
        }

        try {
          const rzSub = await rzGetSubscription(subRow.razorpay_subscription_id);
          const result = await reconcileSubscriptionWithRazorpay(userId, rzSub);
          return Response.json({ ok: true, ...result });
        } catch (e: unknown) {
          console.error("[billing/sync-subscription]", e);
          return Response.json(
            { ok: false, code: "SYNC_FAILED", message: friendlyRazorpayError(e) },
            { status: 502 },
          );
        }
      },
    },
  },
});
