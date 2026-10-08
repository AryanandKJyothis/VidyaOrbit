import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import {
  computeNewExpiry,
  isCompedSubscription,
  isTierChangeBlocked,
} from "@/lib/billing-guards";
import { verifyCheckoutSignature } from "@/lib/billing-signature";

describe("isCompedSubscription", () => {
  it("allows free plan with NULL expiry", () => {
    expect(
      isCompedSubscription({
        plan: "free",
        plan_price: null,
        expiry_date: null,
      }),
    ).toBe(false);
  });

  it("allows no subscription", () => {
    expect(isCompedSubscription(null)).toBe(false);
  });

  it("blocks comped pro with NULL expiry", () => {
    expect(
      isCompedSubscription({
        plan: "pro",
        plan_price: null,
        expiry_date: null,
      }),
    ).toBe(true);
  });

  it("blocks growth with price 0", () => {
    expect(
      isCompedSubscription({
        plan: "growth",
        plan_price: 0,
        expiry_date: "2026-12-31",
      }),
    ).toBe(true);
  });

  it("allows paid plans", () => {
    expect(
      isCompedSubscription({
        plan: "growth",
        plan_price: 999,
        expiry_date: "2027-01-01",
      }),
    ).toBe(false);
  });
});

describe("verifyCheckoutSignature", () => {
  const secret = "test_secret_key_12345";
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";

  it("accepts a valid signature", () => {
    const sig = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    expect(verifyCheckoutSignature(orderId, paymentId, sig, secret)).toBe(true);
  });

  it("rejects a short signature without throwing", () => {
    expect(verifyCheckoutSignature(orderId, paymentId, "abc", secret)).toBe(
      false,
    );
  });

  it("rejects the wrong secret", () => {
    const sig = crypto
      .createHmac("sha256", "other")
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    expect(verifyCheckoutSignature(orderId, paymentId, sig, secret)).toBe(
      false,
    );
  });
});

describe("isTierChangeBlocked", () => {
  const now = new Date("2026-10-08T00:00:00Z");
  const in30 = "2026-11-07T00:00:00Z";
  const in7 = "2026-10-15T00:00:00Z";
  const expired = "2026-09-01T00:00:00Z";

  it("allows same-tier renewal while time remains (expiry will extend)", () => {
    expect(
      isTierChangeBlocked(
        { plan: "growth", plan_price: 999, expiry_date: in30 },
        "growth",
        now,
      ),
    ).toBe(false);
  });

  it("refuses a different tier with more than 7 days left", () => {
    expect(
      isTierChangeBlocked(
        { plan: "starter", plan_price: 499, expiry_date: in30 },
        "large",
        now,
      ),
    ).toBe(true);
  });

  it("allows a different tier with 7 days left", () => {
    expect(
      isTierChangeBlocked(
        { plan: "growth", plan_price: 999, expiry_date: in7 },
        "starter",
        now,
      ),
    ).toBe(false);
  });

  it("allows a different tier when expired", () => {
    expect(
      isTierChangeBlocked(
        { plan: "growth", plan_price: 999, expiry_date: expired },
        "starter",
        now,
      ),
    ).toBe(false);
  });

  it("allows any tier for free accounts", () => {
    expect(
      isTierChangeBlocked(
        { plan: "free", plan_price: null, expiry_date: null },
        "large",
        now,
      ),
    ).toBe(false);
  });
});

describe("computeNewExpiry", () => {
  const now = new Date("2026-10-08T12:00:00Z");

  it("from the past starts at now + 1 month", () => {
    const result = computeNewExpiry(
      now,
      new Date("2026-01-01T00:00:00Z"),
      "monthly",
    );
    expect(result.toISOString()).toBe("2026-11-08T12:00:00.000Z");
  });

  it("from null starts at now + 1 month", () => {
    const result = computeNewExpiry(now, null, "monthly");
    expect(result.toISOString()).toBe("2026-11-08T12:00:00.000Z");
  });

  it("from the future extends the current expiry by 1 month", () => {
    const result = computeNewExpiry(
      now,
      new Date("2026-12-01T00:00:00Z"),
      "monthly",
    );
    expect(result.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("annual adds 12 months", () => {
    const result = computeNewExpiry(now, null, "annual");
    expect(result.toISOString()).toBe("2027-10-08T12:00:00.000Z");
  });
});
