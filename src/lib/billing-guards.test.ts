import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import {
  evaluatePendingFollowup,
  getBillingSupportContact,
  isCompedSubscription,
  isTierChangeBlocked,
  kolkataCalendarDaysUntil,
  tierChangeSupportMessage,
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

  it("rejects a non-ASCII signature without throwing (byte-length check)", () => {
    expect(
      verifyCheckoutSignature(orderId, paymentId, "á".repeat(64), secret),
    ).toBe(false);
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

describe("isTierChangeBlocked (Asia/Kolkata calendar days)", () => {
  const now = new Date("2026-10-08T00:00:00Z");
  const in30 = "2026-11-07T00:00:00Z";
  const in7 = "2026-10-15T00:00:00Z";
  const expired = "2026-09-01T00:00:00Z";

  it("counts whole Kolkata calendar days", () => {
    expect(
      kolkataCalendarDaysUntil(new Date("2026-10-15T00:00:00Z"), now),
    ).toBe(7);
  });

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

  it("allows a different tier with exactly 7 days left", () => {
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

  it("tab A Large then tab B Starter annual then tab A pay: activation must block", () => {
    // Starter with 7 Kolkata days left: create-order allows Large (tab A).
    const sevenLeft = {
      plan: "starter",
      plan_price: 499,
      expiry_date: in7,
    };
    expect(isTierChangeBlocked(sevenLeft, "large", now)).toBe(false);

    // Tab B: same-tier Starter annual is allowed and extends ~12 months.
    expect(isTierChangeBlocked(sevenLeft, "starter", now)).toBe(false);
    const afterAnnual = {
      plan: "starter",
      plan_price: 499,
      expiry_date: "2027-10-15T00:00:00Z",
    };

    // Tab A payment: SQL activate_billing_order uses this same predicate
    // (Asia/Kolkata days > 7 and different paid tier) and marks the paid
    // order needs_review instead of extending Large from the new expiry.
    expect(isTierChangeBlocked(afterAnnual, "large", now)).toBe(true);
  });
});

describe("evaluatePendingFollowup", () => {
  it("does not treat a same-tier renewal as success until expiry moves", () => {
    expect(
      evaluatePendingFollowup({
        expectedPlan: "growth",
        previousPlan: "growth",
        previousExpiry: "2026-11-01T00:00:00Z",
        subscription: {
          plan: "growth",
          status: "active",
          expired: false,
          expiry_date: "2026-11-01T00:00:00Z",
        },
        order: { needs_review: false, activated_at: null },
      }),
    ).toBe("wait");
  });

  it("succeeds a same-tier renewal once expiry moves past the old value", () => {
    expect(
      evaluatePendingFollowup({
        expectedPlan: "growth",
        previousPlan: "growth",
        previousExpiry: "2026-11-01T00:00:00Z",
        subscription: {
          plan: "growth",
          status: "active",
          expired: false,
          expiry_date: "2026-12-01T00:00:00Z",
        },
        order: { needs_review: false, activated_at: "2026-10-08T00:00:00Z" },
      }),
    ).toBe("success");
  });

  it("succeeds a same-tier renewal when the order is activated even if expiry is stale", () => {
    expect(
      evaluatePendingFollowup({
        expectedPlan: "growth",
        previousPlan: "growth",
        previousExpiry: "2026-11-01T00:00:00Z",
        subscription: {
          plan: "growth",
          status: "active",
          expired: false,
          expiry_date: "2026-11-01T00:00:00Z",
        },
        order: { needs_review: false, activated_at: "2026-10-08T00:00:00Z" },
      }),
    ).toBe("success");
  });

  it("returns held when the order is flagged needs_review", () => {
    expect(
      evaluatePendingFollowup({
        expectedPlan: "pro",
        previousPlan: "starter",
        previousExpiry: "2026-11-01T00:00:00Z",
        subscription: {
          plan: "starter",
          status: "active",
          expired: false,
          expiry_date: "2026-11-01T00:00:00Z",
        },
        order: { needs_review: true, activated_at: "2026-10-08T00:00:00Z" },
      }),
    ).toBe("held");
  });
});

describe("tier-change support contact", () => {
  it("uses wa.me when WhatsApp is configured", () => {
    const c = getBillingSupportContact({
      VITE_CONTACT_WHATSAPP: "+91 98765 43210",
      VITE_CONTACT_EMAIL: "hi@example.com",
    } as NodeJS.ProcessEnv);
    expect(c.channel).toBe("whatsapp");
    expect(c.link).toBe("https://wa.me/919876543210");
    expect(tierChangeSupportMessage(c.channel)).toMatch(/WhatsApp/);
  });

  it("uses contact-config WhatsApp default when env is unset", () => {
    const c = getBillingSupportContact({} as NodeJS.ProcessEnv);
    expect(c.channel).toBe("whatsapp");
    expect(c.link).toBe("https://wa.me/917025063047");
    expect(tierChangeSupportMessage(c.channel)).toMatch(/WhatsApp/);
  });
});
