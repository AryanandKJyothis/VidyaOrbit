/**
 * Tests for comped account protection — imports the real predicate.
 */
import { describe, expect, it } from "vitest";
import { isCompedSubscription } from "@/lib/billing-guards";

describe("Comped Account Logic", () => {
  it("allows free plan with NULL expiry to buy", () => {
    expect(
      isCompedSubscription({
        plan: "free",
        plan_price: null,
        expiry_date: null,
      }),
    ).toBe(false);
  });

  it("allows no subscription (null) to buy", () => {
    expect(isCompedSubscription(null)).toBe(false);
  });

  it("blocks comped Pro with NULL expiry", () => {
    expect(
      isCompedSubscription({
        plan: "pro",
        plan_price: null,
        expiry_date: null,
      }),
    ).toBe(true);
  });

  it("blocks comped Growth with price 0", () => {
    expect(
      isCompedSubscription({
        plan: "growth",
        plan_price: 0,
        expiry_date: "2026-12-31",
      }),
    ).toBe(true);
  });

  it("allows paid and expired to renew", () => {
    expect(
      isCompedSubscription({
        plan: "growth",
        plan_price: 10000,
        expiry_date: "2025-01-01",
      }),
    ).toBe(false);
  });

  it("allows active paid subscription to renew", () => {
    expect(
      isCompedSubscription({
        plan: "growth",
        plan_price: 10000,
        expiry_date: "2027-01-01",
      }),
    ).toBe(false);
  });
});
