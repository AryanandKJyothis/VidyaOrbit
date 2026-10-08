import { describe, expect, it } from "vitest";
import { computePricing, TIER_CONFIGS } from "@/lib/billing-pricing";
import { APPROVED_PRICING, getPlanByCode } from "@/lib/pricing-display";

const rupees = (paise: number) => paise / 100;

describe("pricing-display matches billing-pricing", () => {
  it("Starter ₹499/mo, ₹4,999/yr", () => {
    const display = getPlanByCode("starter")!;
    expect(display.monthlyPrice).toBe(499);
    expect(display.annualPrice).toBe(4999);
    expect(rupees(TIER_CONFIGS.starter.monthly_price_paise)).toBe(499);
    expect(rupees(TIER_CONFIGS.starter.annual_price_paise)).toBe(4999);
    expect(display.monthlyPrice * 100).toBe(
      TIER_CONFIGS.starter.monthly_price_paise,
    );
    expect(display.annualPrice * 100).toBe(
      TIER_CONFIGS.starter.annual_price_paise,
    );
  });

  it("Growth ₹999/mo, ₹10,000/yr", () => {
    const display = getPlanByCode("growth")!;
    expect(display.monthlyPrice).toBe(999);
    expect(display.annualPrice).toBe(10000);
    expect(rupees(TIER_CONFIGS.growth.monthly_price_paise)).toBe(999);
    expect(rupees(TIER_CONFIGS.growth.annual_price_paise)).toBe(10000);
  });

  it("Large ₹2,499/mo, ₹25,000/yr", () => {
    const display = getPlanByCode("large")!;
    expect(display.monthlyPrice).toBe(2499);
    expect(display.annualPrice).toBe(25000);
    expect(rupees(TIER_CONFIGS.large.monthly_price_paise)).toBe(2499);
    expect(rupees(TIER_CONFIGS.large.annual_price_paise)).toBe(25000);
  });

  it("Setup fee ₹5,000 on Growth/Large first monthly only, waived on annual", () => {
    const starter = getPlanByCode("starter")!;
    const growth = getPlanByCode("growth")!;
    const large = getPlanByCode("large")!;
    expect(starter.setupFee).toBe(0);
    expect(growth.setupFee).toBe(5000);
    expect(large.setupFee).toBe(5000);
    expect(growth.annualSetupFee).toBe(0);
    expect(large.annualSetupFee).toBe(0);
    expect(rupees(TIER_CONFIGS.growth.setup_fee_paise)).toBe(5000);
    expect(rupees(TIER_CONFIGS.large.setup_fee_paise)).toBe(5000);
    expect(TIER_CONFIGS.starter.setup_fee_paise).toBe(0);

    const hasSetup = (
      tier: "starter" | "growth" | "large",
      cycle: "monthly" | "annual",
      paid: boolean,
    ) =>
      computePricing(tier, cycle, paid).line_items.some(
        (i) => i.item === "setup_fee" && i.amount > 0,
      );

    expect(hasSetup("growth", "monthly", false)).toBe(true);
    expect(hasSetup("large", "monthly", false)).toBe(true);
    expect(hasSetup("growth", "monthly", true)).toBe(false);
    expect(hasSetup("large", "monthly", true)).toBe(false);
    expect(hasSetup("growth", "annual", false)).toBe(false);
    expect(hasSetup("large", "annual", false)).toBe(false);
    expect(hasSetup("starter", "monthly", false)).toBe(false);
  });

  it("APPROVED_PRICING covers the four public tiers", () => {
    expect(APPROVED_PRICING.map((p) => p.code)).toEqual([
      "free",
      "starter",
      "growth",
      "large",
    ]);
  });
});
