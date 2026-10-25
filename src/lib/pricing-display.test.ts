import { describe, expect, it } from "vitest";
import { computePricing, TIER_CONFIGS } from "@/lib/billing-pricing";
import {
  APPROVED_PRICING,
  DFY_SETUP_FEE,
  dfySetupLine,
  formatIndianPrice,
  getAnnualSavings,
  getAnnualSavingsLabel,
  getPlanByCode,
} from "@/lib/pricing-display";

const rupees = (paise: number) => paise / 100;

describe("pricing-display matches billing-pricing", () => {
  it("Spark ₹499/mo, ₹4,999/yr", () => {
    const display = getPlanByCode("starter")!;
    expect(display.displayName).toBe("Spark");
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

  it("Orbit ₹999/mo, ₹10,000/yr", () => {
    const display = getPlanByCode("growth")!;
    expect(display.displayName).toBe("Orbit");
    expect(display.monthlyPrice).toBe(999);
    expect(display.annualPrice).toBe(10000);
    expect(rupees(TIER_CONFIGS.growth.monthly_price_paise)).toBe(999);
    expect(rupees(TIER_CONFIGS.growth.annual_price_paise)).toBe(10000);
  });

  it("Centre ₹1,499/mo, ₹15,000/yr", () => {
    const display = getPlanByCode("large")!;
    expect(display.displayName).toBe("Centre");
    expect(display.monthlyPrice).toBe(1499);
    expect(display.annualPrice).toBe(15000);
    expect(rupees(TIER_CONFIGS.large.monthly_price_paise)).toBe(1499);
    expect(rupees(TIER_CONFIGS.large.annual_price_paise)).toBe(15000);
  });

  it("DFY setup ₹5,000 on Orbit/Centre first monthly only, waived on annual", () => {
    const starter = getPlanByCode("starter")!;
    const growth = getPlanByCode("growth")!;
    const large = getPlanByCode("large")!;
    expect(starter.setupFee).toBe(0);
    expect(growth.setupFee).toBe(DFY_SETUP_FEE);
    expect(large.setupFee).toBe(DFY_SETUP_FEE);
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
    expect(APPROVED_PRICING.map((p) => p.displayName)).toEqual([
      "Free",
      "Spark",
      "Orbit",
      "Centre",
    ]);
  });
});

describe("approved public prices", () => {
  it("matches the locked price table", () => {
    const byCode = Object.fromEntries(APPROVED_PRICING.map((p) => [p.code, p]));
    expect(byCode.free).toMatchObject({
      monthlyPrice: 0,
      studentLimit: "Up to 25 students",
      setupFee: 0,
    });
    expect(byCode.starter).toMatchObject({
      displayName: "Spark",
      monthlyPrice: 499,
      annualPrice: 4999,
      setupFee: 0,
    });
    expect(byCode.growth).toMatchObject({
      displayName: "Orbit",
      monthlyPrice: 999,
      annualPrice: 10000,
      setupFee: 5000,
    });
    expect(byCode.large).toMatchObject({
      displayName: "Centre",
      monthlyPrice: 1499,
      annualPrice: 15000,
      setupFee: 5000,
    });
  });

  it("does not use a Most popular badge label", () => {
    const blob = JSON.stringify(APPROVED_PRICING).toLowerCase();
    expect(blob).not.toContain("most popular");
  });

  it("formats INR the Indian way", () => {
    expect(formatIndianPrice(499)).toBe("₹499");
    expect(formatIndianPrice(1499)).toBe("₹1,499");
    expect(formatIndianPrice(4999)).toBe("₹4,999");
  });

  it("computes annual savings without mixing in setup", () => {
    const growth = APPROVED_PRICING.find((p) => p.code === "growth")!;
    expect(getAnnualSavings(growth)).toBe(999 * 12 - 10000);
    expect(getAnnualSavingsLabel(growth)).toBe(
      "Save ₹1,988 · DFY setup waived",
    );
  });

  it("frames DFY setup as optional, not a no-setup claim", () => {
    const line = dfySetupLine().toLowerCase();
    expect(line).toContain("optional");
    expect(line).toContain("₹5,000".toLowerCase());
    expect(line).toContain("orbit");
    expect(line).toContain("centre");
    expect(line).not.toContain("no setup");
  });
});
