import { describe, expect, it } from "vitest";
import {
  ADMIN_LIST_PRICE_PAISE,
  annualMrrPaise,
  isPayingCentre,
  mapAlert,
  mapCentreRow,
  mapOverview,
  mapPaymentRow,
  mapUserRow,
  mrrPaiseForCentre,
  paiseToRupees,
  stripForbiddenAdminFields,
  sumMrrPaise,
} from "@/lib/admin-mrr";
import { TIER_CONFIGS } from "@/lib/billing-pricing";

const now = new Date("2026-10-13T12:00:00.000Z");

describe("admin MRR", () => {
  it("matches checkout list prices in paise", () => {
    expect(ADMIN_LIST_PRICE_PAISE.starter.monthly).toBe(
      TIER_CONFIGS.starter.monthly_price_paise,
    );
    expect(ADMIN_LIST_PRICE_PAISE.starter.annual).toBe(
      TIER_CONFIGS.starter.annual_price_paise,
    );
    expect(ADMIN_LIST_PRICE_PAISE.growth.monthly).toBe(
      TIER_CONFIGS.growth.monthly_price_paise,
    );
    expect(ADMIN_LIST_PRICE_PAISE.growth.annual).toBe(
      TIER_CONFIGS.growth.annual_price_paise,
    );
    // Founder MRR SQL still uses the last migrated pro list price (₹2,499).
    // Public checkout is Centre at ₹1,499. No admin SQL migration in this wave.
    expect(ADMIN_LIST_PRICE_PAISE.pro.monthly).toBe(249900);
    expect(ADMIN_LIST_PRICE_PAISE.pro.annual).toBe(2500000);
    expect(TIER_CONFIGS.large.monthly_price_paise).toBe(149900);
    expect(TIER_CONFIGS.large.annual_price_paise).toBe(1500000);
  });

  it("uses monthly list price for active paid centres without a cycle", () => {
    expect(
      mrrPaiseForCentre({
        plan: "growth",
        status: "active",
        expiryDate: "2027-01-01T00:00:00.000Z",
        cycle: null,
        now,
      }),
    ).toBe(99900);
  });

  it("annualizes annual list price with the same round as SQL", () => {
    expect(annualMrrPaise(499900)).toBe(Math.round(499900 / 12));
    expect(annualMrrPaise(1000000)).toBe(Math.round(1000000 / 12));
    expect(annualMrrPaise(2500000)).toBe(Math.round(2500000 / 12));
    expect(
      mrrPaiseForCentre({
        plan: "pro",
        status: "active",
        expiryDate: null,
        cycle: "annual",
        now,
      }),
    ).toBe(Math.round(2500000 / 12));
  });

  it("excludes free, trialing, canceled, and expired centres", () => {
    expect(
      isPayingCentre({
        plan: "growth",
        status: "trialing",
        expiryDate: "2026-11-01T00:00:00.000Z",
        now,
      }),
    ).toBe(false);
    expect(
      mrrPaiseForCentre({
        plan: "starter",
        status: "canceled",
        expiryDate: null,
        cycle: "monthly",
        now,
      }),
    ).toBe(0);
    expect(
      mrrPaiseForCentre({
        plan: "growth",
        status: "active",
        expiryDate: "2026-09-01T00:00:00.000Z",
        cycle: "monthly",
        now,
      }),
    ).toBe(0);
    expect(
      mrrPaiseForCentre({
        plan: "free",
        status: "active",
        expiryDate: null,
        cycle: "monthly",
        now,
      }),
    ).toBe(0);
  });

  it("sums MRR across a mixed book of centres", () => {
    expect(
      sumMrrPaise(
        [
          {
            plan: "starter",
            status: "active",
            expiryDate: null,
            cycle: "monthly",
          },
          {
            plan: "growth",
            status: "active",
            expiryDate: null,
            cycle: "annual",
          },
          {
            plan: "pro",
            status: "trialing",
            expiryDate: "2026-11-01T00:00:00.000Z",
            cycle: "monthly",
          },
        ],
        now,
      ),
    ).toBe(49900 + Math.round(1000000 / 12));
  });

  it("converts paise to whole rupees", () => {
    expect(paiseToRupees(99900)).toBe(999);
    expect(paiseToRupees(null)).toBe(0);
  });
});

describe("admin mapping", () => {
  it("strips invite and webhook secrets from any payload", () => {
    const clean = stripForbiddenAdminFields({
      id: "1",
      token: "secret-invite",
      raw_body: { card: "4111" },
      signature: "sig",
      rawBody: "also",
      email: "a@b.c",
    });
    expect(clean).toEqual({ id: "1", email: "a@b.c" });
    expect(clean).not.toHaveProperty("token");
    expect(clean).not.toHaveProperty("raw_body");
    expect(clean).not.toHaveProperty("signature");
  });

  it("maps a centre row and drops epoch last-active", () => {
    const row = mapCentreRow({
      owner_id: "11111111-1111-1111-1111-111111111111",
      name: "Samriddhi Centre",
      contact_email: "owner@centre.in",
      student_count: "12",
      plan_limit: 100,
      last_active_at: "1970-01-01T00:00:00.000Z",
      member_emails: ["staff@centre.in"],
      token: "should-not-leak",
    });
    expect(row?.name).toBe("Samriddhi Centre");
    expect(row?.student_count).toBe(12);
    expect(row?.last_active_at).toBeNull();
    expect(row).not.toHaveProperty("token");
  });

  it("maps users, payments, alerts, and overview without forbidden keys", () => {
    const user = mapUserRow({
      user_id: "22222222-2222-2222-2222-222222222222",
      email: "staff@centre.in",
      centres: [
        {
          owner_id: "11111111-1111-1111-1111-111111111111",
          name: "Samriddhi",
          role: "staff",
          is_own: false,
          token: "nope",
        },
      ],
      signature: "x",
    });
    expect(user?.email).toBe("staff@centre.in");
    expect(user?.centres[0]?.role).toBe("staff");
    expect(JSON.stringify(user)).not.toMatch(/token|signature|raw_body/);

    const pay = mapPaymentRow({
      id: "33333333-3333-3333-3333-333333333333",
      owner_id: "11111111-1111-1111-1111-111111111111",
      amount_paise: 99900,
      status: "paid",
      raw_body: { hidden: true },
      signature: "s",
    });
    expect(pay?.amount_paise).toBe(99900);
    expect(JSON.stringify(pay)).not.toMatch(/raw_body|signature/);

    const alert = mapAlert({
      kind: "needs_review",
      severity: "danger",
      title: "Paid order needs review",
      href: "/admin/centres",
      token: "no",
    });
    expect(alert?.kind).toBe("needs_review");
    expect(JSON.stringify(alert)).not.toMatch(/token/);

    const overview = mapOverview({
      centres: 4,
      mrr_paise: 99900,
      signup_trend: [{ day: "2026-10-01", users: 1, centres: 1 }],
      plan_mix: [{ plan: "growth", count: 2 }],
    });
    expect(overview.centres).toBe(4);
    expect(overview.mrr_paise).toBe(99900);
    expect(overview.signup_trend).toHaveLength(1);
  });
});
