/**
 * GET /api/billing/pricing
 * Returns server-side pricing configuration for all tiers and cycles.
 * Client reads prices from this endpoint; never hard-coded.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  isBillingEnabled,
  TIER_CONFIGS,
  type PlanTier,
} from "@/lib/billing-pricing";

export const Route = createFileRoute("/api/billing/pricing")({
  server: {
    handlers: {
      GET: async () => {
        if (!isBillingEnabled()) {
          return Response.json(
            {
              ok: false,
              enabled: false,
              message: "Billing is not enabled.",
            },
            { status: 503 },
          );
        }

        // Transform config for client consumption
        const tiers: Record<
          PlanTier,
          {
            tier: PlanTier;
            student_limit: number;
            display_name: string;
            description: string;
            monthly_price_paise: number;
            annual_price_paise: number;
            monthly_setup_paise: number;
            annual_setup_paise: number;
          }
        > = {
          starter: {
            tier: "starter",
            student_limit: TIER_CONFIGS.starter.student_limit,
            display_name: TIER_CONFIGS.starter.display_name,
            description: TIER_CONFIGS.starter.description,
            monthly_price_paise: TIER_CONFIGS.starter.monthly_price_paise,
            annual_price_paise: TIER_CONFIGS.starter.annual_price_paise,
            monthly_setup_paise: TIER_CONFIGS.starter.setup_fee_paise,
            annual_setup_paise: 0, // Annual waives setup
          },
          growth: {
            tier: "growth",
            student_limit: TIER_CONFIGS.growth.student_limit,
            display_name: TIER_CONFIGS.growth.display_name,
            description: TIER_CONFIGS.growth.description,
            monthly_price_paise: TIER_CONFIGS.growth.monthly_price_paise,
            annual_price_paise: TIER_CONFIGS.growth.annual_price_paise,
            monthly_setup_paise: TIER_CONFIGS.growth.setup_fee_paise,
            annual_setup_paise: 0,
          },
          large: {
            tier: "large",
            student_limit: TIER_CONFIGS.large.student_limit,
            display_name: TIER_CONFIGS.large.display_name,
            description: TIER_CONFIGS.large.description,
            monthly_price_paise: TIER_CONFIGS.large.monthly_price_paise,
            annual_price_paise: TIER_CONFIGS.large.annual_price_paise,
            monthly_setup_paise: TIER_CONFIGS.large.setup_fee_paise,
            annual_setup_paise: 0,
          },
        };

        return Response.json({
          ok: true,
          enabled: true,
          tiers,
        });
      },
    },
  },
});
