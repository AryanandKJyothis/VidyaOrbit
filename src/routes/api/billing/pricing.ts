/**
 * GET /api/billing/pricing
 * Returns server-side pricing configuration for all tiers and cycles.
 * Client reads prices from this endpoint; never hard-coded.
 * Always returns 200 with prices, plus billingEnabled flag.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  isBillingEnabled,
  TIER_CONFIGS,
  type PlanTier,
} from "@/lib/billing-pricing";
import { getPlanByCode } from "@/lib/pricing-display";

export const Route = createFileRoute("/api/billing/pricing")({
  server: {
    handlers: {
      GET: async () => {
        const billingEnabled = isBillingEnabled();

        // Always return 200 with prices and flag
        const tiers = (["starter", "growth", "large"] as const).map(
          (t: PlanTier) => ({
            tier: t,
            name: TIER_CONFIGS[t].display_name,
            description: TIER_CONFIGS[t].description,
            studentLimit: t === "large" ? null : TIER_CONFIGS[t].student_limit,
            monthlyPricePaise: TIER_CONFIGS[t].monthly_price_paise,
            annualPricePaise: TIER_CONFIGS[t].annual_price_paise,
            setupFeePaise: TIER_CONFIGS[t].setup_fee_paise,
            features: getPlanByCode(t)?.features ?? [],
          }),
        );

        return Response.json(
          {
            billingEnabled,
            tiers,
          },
          {
            headers: {
              "Cache-Control": "public, max-age=300",
            },
          },
        );
      },
    },
  },
});
