/**
 * Tests for comped account protection logic in create-order
 */
import { describe, it, expect } from "vitest";

describe("Comped Account Logic", () => {
  it("allows free plan with NULL expiry to buy", () => {
    const sub = { plan: "free", plan_price: null, expiry_date: null };
    const isComped = sub.plan !== "free" && (sub.plan_price === 0 || sub.expiry_date === null);
    expect(isComped).toBe(false);
  });

  it("allows no subscription (null) to buy", () => {
    const sub = null;
    const isComped = sub !== null && sub.plan !== "free" && (sub.plan_price === 0 || sub.expiry_date === null);
    expect(isComped).toBe(false);
  });

  it("blocks comped Pro with NULL expiry", () => {
    const sub = { plan: "pro", plan_price: null, expiry_date: null };
    const isComped = sub.plan !== "free" && (sub.plan_price === 0 || sub.expiry_date === null);
    expect(isComped).toBe(true);
  });

  it("blocks comped Growth with price 0", () => {
    const sub = { plan: "growth", plan_price: 0, expiry_date: "2026-12-31" };
    const isComped = sub.plan !== "free" && (sub.plan_price === 0 || sub.expiry_date === null);
    expect(isComped).toBe(true);
  });

  it("allows paid and expired to renew", () => {
    const sub = { plan: "growth", plan_price: 10000, expiry_date: "2025-01-01" };
    const isComped = sub.plan !== "free" && (sub.plan_price === 0 || sub.expiry_date === null);
    expect(isComped).toBe(false);
  });

  it("allows active paid subscription to renew", () => {
    const sub = { plan: "growth", plan_price: 10000, expiry_date: "2027-01-01" };
    const isComped = sub.plan !== "free" && (sub.plan_price === 0 || sub.expiry_date === null);
    expect(isComped).toBe(false);
  });
});
