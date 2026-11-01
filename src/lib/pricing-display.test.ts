import { describe, expect, it } from "vitest";
import {
  CAMPUS_CONFIG,
  computePricing,
  TIER_CONFIGS,
} from "@/lib/billing-pricing";
import {
  APPROVED_PRICING,
  CAMPUS_SETUP_FEE,
  CENTRE_SETUP_FEE,
  WHATSAPP_COMING_SOON_LINE,
  dfySetupLine,
  formatIndianPrice,
  getAnnualSavings,
  getAnnualSavingsLabel,
  getPlanByCode,
} from "@/lib/pricing-display";

const rupees = (paise: number) => paise / 100;

describe("pricing-display matches billing-pricing (Nov 1 2026)", () => {
  it.each([
    ["starter", "Spark", 499, 4990],
    ["growth", "Orbit", 999, 9990],
    ["large", "Centre", 1499, 14990],
  ] as const)("%s = %s ₹%i/mo, ₹%i/yr", (tier, name, monthly, annual) => {
    const display = getPlanByCode(tier)!;
    expect(display.displayName).toBe(name);
    expect(display.monthlyPrice).toBe(monthly);
    expect(display.annualPrice).toBe(annual);
    expect(annual).toBe(monthly * 10);
    expect(rupees(TIER_CONFIGS[tier].monthly_price_paise)).toBe(monthly);
    expect(rupees(TIER_CONFIGS[tier].annual_price_paise)).toBe(annual);
  });

  it("Campus ₹2,499/mo, ₹24,990/yr, ₹3,000 setup", () => {
    const display = getPlanByCode("campus")!;
    expect(display.displayName).toBe("Campus");
    expect(display.monthlyPrice * 100).toBe(CAMPUS_CONFIG.monthly_price_paise);
    expect(display.annualPrice * 100).toBe(CAMPUS_CONFIG.annual_price_paise);
    expect(display.setupFee * 100).toBe(CAMPUS_CONFIG.setup_fee_paise);
    expect(display.setupFee).toBe(3000);
  });

  it("setup: free on Spark/Orbit, ₹2,000 Centre monthly only, waived on yearly", () => {
    expect(getPlanByCode("starter")!.setupFee).toBe(0);
    expect(getPlanByCode("growth")!.setupFee).toBe(0);
    expect(getPlanByCode("large")!.setupFee).toBe(CENTRE_SETUP_FEE);
    expect(rupees(TIER_CONFIGS.large.setup_fee_paise)).toBe(2000);
    expect(TIER_CONFIGS.starter.setup_fee_paise).toBe(0);
    expect(TIER_CONFIGS.growth.setup_fee_paise).toBe(0);

    const hasSetup = (
      tier: "starter" | "growth" | "large",
      cycle: "monthly" | "annual",
      paid: boolean,
    ) =>
      computePricing(tier, cycle, paid).line_items.some(
        (i) => i.item === "setup_fee" && i.amount > 0,
      );
    expect(hasSetup("large", "monthly", false)).toBe(true);
    expect(hasSetup("large", "monthly", true)).toBe(false);
    expect(hasSetup("large", "annual", false)).toBe(false);
    expect(hasSetup("growth", "monthly", false)).toBe(false);
    expect(hasSetup("starter", "monthly", false)).toBe(false);
  });

  it("APPROVED_PRICING covers the five public tiers", () => {
    expect(APPROVED_PRICING.map((p) => p.displayName)).toEqual([
      "Free",
      "Spark",
      "Orbit",
      "Centre",
      "Campus",
    ]);
    expect(APPROVED_PRICING.map((p) => p.studentLimit)).toEqual([
      "Up to 25 students",
      "Up to 50 students",
      "Up to 150 students",
      "Up to 400 students",
      "400+ students",
    ]);
  });
});

describe("approved public prices", () => {
  it("does not use a Most popular badge label", () => {
    const blob = JSON.stringify(APPROVED_PRICING).toLowerCase();
    expect(blob).not.toContain("most popular");
  });

  it("never claims WhatsApp alerts are included", () => {
    const blob = JSON.stringify(APPROVED_PRICING).toLowerCase();
    expect(blob).not.toMatch(/whatsapp (alerts|reminders|notifications)/);
    expect(WHATSAPP_COMING_SOON_LINE).toBe(
      "WhatsApp alerts coming soon, free when they arrive.",
    );
  });

  it("formats INR the Indian way", () => {
    expect(formatIndianPrice(499)).toBe("₹499");
    expect(formatIndianPrice(1499)).toBe("₹1,499");
    expect(formatIndianPrice(24990)).toBe("₹24,990");
  });

  it("yearly = 2 months free, setup not mixed in", () => {
    const growth = getPlanByCode("growth")!;
    expect(getAnnualSavings(growth)).toBe(999 * 2);
    expect(getAnnualSavingsLabel(growth)).toBe("2 months free");
    expect(getAnnualSavingsLabel(getPlanByCode("large")!)).toBe(
      "2 months free · setup waived",
    );
  });

  it("setup line names the per-plan fees", () => {
    const line = dfySetupLine();
    expect(line).toContain("₹2,000");
    expect(line).toContain(formatIndianPrice(CAMPUS_SETUP_FEE));
    expect(line.toLowerCase()).toContain("yearly plans waive setup");
  });
});
