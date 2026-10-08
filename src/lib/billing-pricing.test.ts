/**
 * Tests for billing pricing logic (tier + cycle model)
 */
import { describe, it, expect } from "vitest";
import {
  computePricing,
  hasSetupFeePaid,
  lineItemsIncludeSetup,
  setupFeePaidFromSubscription,
  type PlanTier,
} from "@/lib/billing-pricing";

describe("setupFeePaidFromSubscription", () => {
  it("is true only when the admin flag is set", () => {
    expect(
      setupFeePaidFromSubscription({
        setup_fee_paid: true,
        plan: "free",
        expiry_date: null,
      }),
    ).toBe(true);
  });

  it("is false for a non-free plan without the flag (trial/comp/admin-set)", () => {
    expect(
      setupFeePaidFromSubscription({
        setup_fee_paid: false,
        plan: "growth",
        expiry_date: "2026-12-01",
      }),
    ).toBe(false);
  });

  it("is false when an expiry remains after returning to free", () => {
    expect(
      setupFeePaidFromSubscription({
        setup_fee_paid: false,
        plan: "free",
        expiry_date: "2026-01-01",
      }),
    ).toBe(false);
  });

  it("is false for a brand-new free account", () => {
    expect(
      setupFeePaidFromSubscription({
        setup_fee_paid: false,
        plan: "free",
        expiry_date: null,
      }),
    ).toBe(false);
  });
});

describe("lineItemsIncludeSetup", () => {
  it("is true when a setup_fee line has amount > 0", () => {
    expect(
      lineItemsIncludeSetup([
        { item: "setup_fee", amount: 500000 },
        { item: "subscription_charge", amount: 99900 },
      ]),
    ).toBe(true);
  });

  it("is false when setup is missing or zero", () => {
    expect(
      lineItemsIncludeSetup([{ item: "subscription_charge", amount: 99900 }]),
    ).toBe(false);
    expect(lineItemsIncludeSetup([{ item: "setup_fee", amount: 0 }])).toBe(
      false,
    );
    expect(lineItemsIncludeSetup(null)).toBe(false);
  });
});

describe("hasSetupFeePaid", () => {
  it("is true when an activated online order included setup", async () => {
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            not: async () => ({
              data: [
                {
                  line_items: [
                    { item: "setup_fee", amount: 500000 },
                    { item: "subscription_charge", amount: 99900 },
                  ],
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    };
    await expect(
      hasSetupFeePaid("owner", db as never, { setup_fee_paid: false }),
    ).resolves.toBe(true);
  });

  it("is false when activated orders did not include setup", async () => {
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            not: async () => ({
              data: [
                {
                  line_items: [
                    { item: "subscription_charge", amount: 1000000 },
                  ],
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    };
    await expect(
      hasSetupFeePaid("owner", db as never, { setup_fee_paid: false }),
    ).resolves.toBe(false);
  });
});

describe("Billing Pricing (Tier + Cycle)", () => {
  describe("Starter tier", () => {
    it("should compute monthly without setup (setup is ₹0)", () => {
      const result = computePricing("starter", "monthly", false);

      expect(result.total).toBe(49900); // ₹499
      expect(result.currency).toBe("INR");
      expect(result.line_items).toHaveLength(1);
      expect(result.line_items[0]).toEqual({
        item: "subscription_charge",
        amount: 49900,
      });
      expect(result.months).toBe(1);
    });

    it("should compute annual without setup (setup is ₹0)", () => {
      const result = computePricing("starter", "annual", false);

      expect(result.total).toBe(499900); // ₹4,999
      expect(result.line_items).toHaveLength(1);
      expect(result.months).toBe(12);
    });
  });

  describe("Growth tier", () => {
    it("should compute monthly with setup on first order", () => {
      const result = computePricing("growth", "monthly", false);

      expect(result.total).toBe(599900); // ₹5,999 (₹999 + ₹5,000)
      expect(result.line_items).toHaveLength(2);
      expect(result.line_items[0]).toEqual({
        item: "setup_fee",
        amount: 500000, // ₹5,000
      });
      expect(result.line_items[1]).toEqual({
        item: "subscription_charge",
        amount: 99900, // ₹999
      });
    });

    it("should compute monthly without setup if already paid", () => {
      const result = computePricing("growth", "monthly", true);

      expect(result.total).toBe(99900); // ₹999 only
      expect(result.line_items).toHaveLength(1);
      expect(result.line_items[0].item).toBe("subscription_charge");
    });

    it("should compute annual without setup (waived)", () => {
      const result = computePricing("growth", "annual", false);

      expect(result.total).toBe(1000000); // ₹10,000 only
      expect(result.line_items).toHaveLength(1);
      expect(result.line_items[0]).toEqual({
        item: "subscription_charge",
        amount: 1000000,
      });
      expect(result.months).toBe(12);
    });

    it("should compute annual without setup even if already paid", () => {
      const result = computePricing("growth", "annual", true);

      expect(result.total).toBe(1000000); // ₹10,000 only
      expect(result.line_items).toHaveLength(1);
    });
  });

  describe("Large tier", () => {
    it("should compute monthly with setup on first order", () => {
      const result = computePricing("large", "monthly", false);

      expect(result.total).toBe(749900); // ₹7,499 (₹2,499 + ₹5,000)
      expect(result.line_items).toHaveLength(2);
      expect(result.line_items[0]).toEqual({
        item: "setup_fee",
        amount: 500000, // ₹5,000
      });
      expect(result.line_items[1]).toEqual({
        item: "subscription_charge",
        amount: 249900, // ₹2,499
      });
    });

    it("should compute monthly without setup if already paid", () => {
      const result = computePricing("large", "monthly", true);

      expect(result.total).toBe(249900); // ₹2,499 only
      expect(result.line_items).toHaveLength(1);
    });

    it("should compute annual without setup (waived)", () => {
      const result = computePricing("large", "annual", false);

      expect(result.total).toBe(2500000); // ₹25,000 only
      expect(result.line_items).toHaveLength(1);
      expect(result.months).toBe(12);
    });
  });

  describe("Setup fee logic", () => {
    it("annual waives setup for all tiers", () => {
      const starter = computePricing("starter", "annual", false);
      const growth = computePricing("growth", "annual", false);
      const large = computePricing("large", "annual", false);

      // None should have setup_fee in line_items
      expect(starter.line_items.some((i) => i.item === "setup_fee")).toBe(
        false,
      );
      expect(growth.line_items.some((i) => i.item === "setup_fee")).toBe(false);
      expect(large.line_items.some((i) => i.item === "setup_fee")).toBe(false);
    });

    it("monthly charges setup only once", () => {
      const firstOrder = computePricing("growth", "monthly", false);
      const renewOrder = computePricing("growth", "monthly", true);

      expect(firstOrder.line_items.some((i) => i.item === "setup_fee")).toBe(
        true,
      );
      expect(renewOrder.line_items.some((i) => i.item === "setup_fee")).toBe(
        false,
      );
    });

    it("annual to monthly: no setup if already paid", () => {
      // Scenario: user starts with annual (setup waived), then switches to monthly
      const annual = computePricing("growth", "annual", false);
      const monthly = computePricing("growth", "monthly", true); // hasPaidSetup=true from annual order

      expect(annual.line_items.some((i) => i.item === "setup_fee")).toBe(false);
      expect(monthly.line_items.some((i) => i.item === "setup_fee")).toBe(
        false,
      );
    });

    it("monthly to annual: smooth upgrade", () => {
      // Scenario: user starts with monthly (setup paid), then upgrades to annual
      const monthly = computePricing("growth", "monthly", false);
      const annual = computePricing("growth", "annual", true);

      expect(monthly.line_items.some((i) => i.item === "setup_fee")).toBe(true);
      expect(annual.line_items.some((i) => i.item === "setup_fee")).toBe(false);
    });
  });

  describe("Savings", () => {
    it("should show correct savings for annual vs monthly", () => {
      const tiers: PlanTier[] = ["starter", "growth", "large"];
      const expectedSavings = [
        989, // Starter: 12×499 − 4,999 = 5,988 − 4,999 = 989
        1988, // Growth: 12×999 − 10,000 = 11,988 − 10,000 = 1,988
        4988, // Large: 12×2,499 − 25,000 = 29,988 − 25,000 = 4,988
      ];

      tiers.forEach((tier, i) => {
        const monthly = computePricing(tier, "monthly", true);
        const annual = computePricing(tier, "annual", true);

        const monthlyYearly = monthly.total * 12;
        const savings = monthlyYearly - annual.total;

        expect(savings).toBe(expectedSavings[i] * 100); // Convert to paise
      });
    });
  });
});
