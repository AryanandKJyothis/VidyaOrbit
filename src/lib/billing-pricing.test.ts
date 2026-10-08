/**
 * Tests for billing pricing logic
 */
import { describe, it, expect, beforeEach } from "vitest";
import { computePricing, type BillingIntent } from "@/lib/billing-pricing";

describe("Billing Pricing", () => {
  describe("computePricing", () => {
    it("should compute first purchase with setup fee + annual plan", () => {
      const result = computePricing("activate", false);
      
      expect(result.total).toBe(1500000); // ₹15,000 in paise
      expect(result.currency).toBe("INR");
      expect(result.line_items).toHaveLength(2);
      expect(result.line_items[0]).toEqual({
        item: "setup_fee",
        amount: 500000, // ₹5,000
      });
      expect(result.line_items[1]).toEqual({
        item: "annual_plan",
        amount: 1000000, // ₹10,000
      });
    });

    it("should compute renewal without setup fee", () => {
      const result = computePricing("renew", true);
      
      expect(result.total).toBe(1000000); // ₹10,000 in paise
      expect(result.currency).toBe("INR");
      expect(result.line_items).toHaveLength(1);
      expect(result.line_items[0]).toEqual({
        item: "annual_plan",
        amount: 1000000,
      });
    });

    it("should skip setup fee on activate if already paid", () => {
      const result = computePricing("activate", true);
      
      expect(result.total).toBe(1000000); // ₹10,000 only
      expect(result.line_items).toHaveLength(1);
      expect(result.line_items[0].item).toBe("annual_plan");
    });

    it("should include setup fee on activate if not paid", () => {
      const result = computePricing("activate", false);
      
      expect(result.total).toBe(1500000);
      expect(result.line_items).toHaveLength(2);
      const items = result.line_items.map(i => i.item);
      expect(items).toContain("setup_fee");
      expect(items).toContain("annual_plan");
    });

    it("should always charge annual plan regardless of intent", () => {
      const activate = computePricing("activate", true);
      const renew = computePricing("renew", true);
      
      expect(activate.line_items.some(i => i.item === "annual_plan")).toBe(true);
      expect(renew.line_items.some(i => i.item === "annual_plan")).toBe(true);
    });

    it("should use correct amounts", () => {
      const setupResult = computePricing("activate", false);
      const setupFee = setupResult.line_items.find(i => i.item === "setup_fee");
      const annualPlan = setupResult.line_items.find(i => i.item === "annual_plan");
      
      expect(setupFee?.amount).toBe(500000); // ₹5,000 in paise
      expect(annualPlan?.amount).toBe(1000000); // ₹10,000 in paise
    });
  });
});
