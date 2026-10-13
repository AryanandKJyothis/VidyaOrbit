import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { USER_FILTERS } from "@/components/admin/admin-users-panel";
import {
  ADMIN_LIST_PRICE_PAISE,
  excludePlatformAdminRows,
  excludePlatformAdminsFromPage,
  founderOverviewFromFacts,
  isPlatformAdminRow,
  paiseToRupees,
  type FounderCentreFact,
  type FounderPaymentFact,
  type FounderUserFact,
} from "@/lib/admin-mrr";

const MIGRATION =
  "supabase/migrations/20261013200000_admin_platform_rpcs_exclude_admins.sql";

const sql = readFileSync(MIGRATION, "utf8");

const FUNCTIONS = [
  "admin_platform_overview",
  "admin_centres_list",
  "admin_users_list",
  "admin_user_detail",
  "admin_payments_list",
  "admin_alerts",
  "admin_institute_health_summary",
] as const;

function functionBody(name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start).toBeGreaterThan(-1);
  const next = sql.indexOf("CREATE OR REPLACE FUNCTION public.", start + 10);
  return next === -1 ? sql.slice(start) : sql.slice(start, next);
}

const now = new Date("2026-10-13T12:00:00.000Z");
const ADMIN = "admin-owner";
const CUSTOMER = "customer-owner";

const adminPro: FounderCentreFact = {
  ownerId: ADMIN,
  platformAdmin: true,
  plan: "pro",
  status: "active",
  expiryDate: "2027-01-01T00:00:00.000Z",
  cycle: "monthly",
  createdAt: "2026-10-12T08:00:00.000Z",
  lastActiveAt: "2026-10-13T09:00:00.000Z",
};

const customerStarter: FounderCentreFact = {
  ownerId: CUSTOMER,
  platformAdmin: false,
  plan: "starter",
  status: "active",
  expiryDate: "2027-01-01T00:00:00.000Z",
  cycle: "monthly",
  createdAt: "2026-09-01T08:00:00.000Z",
  lastActiveAt: "2026-10-10T09:00:00.000Z",
};

const adminTrial: FounderCentreFact = {
  ownerId: ADMIN,
  platformAdmin: true,
  plan: "growth",
  status: "trialing",
  expiryDate: "2026-10-18T00:00:00.000Z",
  cycle: "monthly",
  createdAt: "2026-10-11T08:00:00.000Z",
  lastActiveAt: "2026-10-13T08:00:00.000Z",
};

const customerTrial: FounderCentreFact = {
  ownerId: "trial-owner",
  platformAdmin: false,
  plan: "growth",
  status: "trialing",
  expiryDate: "2026-10-18T00:00:00.000Z",
  cycle: "monthly",
  createdAt: "2026-10-10T08:00:00.000Z",
  lastActiveAt: "2026-10-12T08:00:00.000Z",
};

const adminUser: FounderUserFact = {
  id: ADMIN,
  platformAdmin: true,
  createdAt: "2026-10-12T08:00:00.000Z",
  lastSignInAt: "2026-10-13T09:00:00.000Z",
};

const customerUser: FounderUserFact = {
  id: CUSTOMER,
  platformAdmin: false,
  createdAt: "2026-09-01T08:00:00.000Z",
  lastSignInAt: "2026-10-10T09:00:00.000Z",
};

const newCustomerUser: FounderUserFact = {
  id: "new-customer",
  platformAdmin: false,
  createdAt: "2026-10-12T08:00:00.000Z",
  lastSignInAt: null,
};

const adminPayment: FounderPaymentFact = {
  ownerId: ADMIN,
  platformAdminOwner: true,
  amountPaise: ADMIN_LIST_PRICE_PAISE.pro.monthly,
  status: "paid",
  keyMode: "live",
  paidAt: "2026-10-12T10:00:00.000Z",
  needsReview: true,
};

const customerPayment: FounderPaymentFact = {
  ownerId: CUSTOMER,
  platformAdminOwner: false,
  amountPaise: ADMIN_LIST_PRICE_PAISE.starter.monthly,
  status: "paid",
  keyMode: "live",
  paidAt: "2026-10-05T10:00:00.000Z",
};

describe("admin RPC migration excludes platform admins by role", () => {
  it("replaces founder-admin RPCs without writing data or hardcoding emails", () => {
    const created = [
      ...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g),
    ].map((m) => m[1]);
    expect(created.sort()).toEqual([...FUNCTIONS].sort());
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
    expect(sql).not.toMatch(/\bCREATE TABLE\b/i);
    expect(sql).not.toMatch(/@gmail\.com/i);
    expect(sql).not.toMatch(/aryanandkjyothis4/i);
    expect(sql).not.toMatch(/'[^\n']*admin@[^\n']*'/i);
  });

  it("uses has_role(..., 'admin') in every RPC, never a hardcoded email", () => {
    for (const name of FUNCTIONS) {
      const body = functionBody(name);
      expect(body).toContain("NOT public.has_role(");
      expect(body).toContain("'admin'");
      expect(body).toContain("SECURITY DEFINER");
      expect(body).toContain("SET search_path TO 'public'");
      expect(body).toContain("STABLE");
    }
  });

  it("covers every overview metric with a role-based admin exclusion", () => {
    const body = functionBody("admin_platform_overview");
    const required: Record<string, string[]> = {
      centres: [
        "'centres', (SELECT COUNT(*) FROM public.institutes i WHERE NOT public.has_role(i.owner_id, 'admin'))",
      ],
      users: [
        "'users', (SELECT COUNT(*) FROM auth.users u WHERE NOT public.has_role(u.id, 'admin'))",
      ],
      active_users_7d: [
        "u.last_sign_in_at > now() - interval '7 days' AND NOT public.has_role(u.id, 'admin')",
      ],
      active_users_30d: [
        "u.last_sign_in_at > now() - interval '30 days' AND NOT public.has_role(u.id, 'admin')",
      ],
      signups_7d: [
        "u.created_at > now() - interval '7 days' AND NOT public.has_role(u.id, 'admin')",
      ],
      signups_30d: [
        "u.created_at > now() - interval '30 days' AND NOT public.has_role(u.id, 'admin')",
      ],
      centre_signups_7d: [
        "i.created_at > now() - interval '7 days' AND NOT public.has_role(i.owner_id, 'admin')",
      ],
      centre_signups_30d: [
        "i.created_at > now() - interval '30 days' AND NOT public.has_role(i.owner_id, 'admin')",
      ],
      signup_trend: [
        "AND NOT public.has_role(u.id, 'admin')) AS users",
        "AND NOT public.has_role(i.owner_id, 'admin')) AS centres",
        "'signup_trend'",
      ],
      mrr_paise: [
        "'mrr_paise', (SELECT COALESCE(SUM(c.mrr_paise), 0) FROM centres c)",
        "WHERE NOT public.has_role(i.owner_id, 'admin')",
      ],
      revenue_30d_paise: ["AND NOT public.has_role(bo.owner_id, 'admin')"],
      paying: ["'paying', (SELECT COUNT(*) FROM centres c WHERE c.paying)"],
      trials: [
        "'trials', (SELECT COUNT(*) FROM centres c WHERE c.status = 'trialing')",
      ],
      trials_ending_7d: ["FROM centres c"],
      expiring_7d: ["FROM centres c"],
      expiring_30d: ["FROM centres c"],
      over_limit: ["FROM centres c"],
      plan_mix: ["FROM centres GROUP BY effective_plan"],
      needs_review: ["AND NOT public.has_role(bo.owner_id, 'admin')"],
      webhook_errors: ["AND NOT public.has_role(d.owner_id, 'admin')"],
    };

    for (const [metric, snippets] of Object.entries(required)) {
      expect(body, metric).toContain(`'${metric}'`);
      for (const snippet of snippets) {
        expect(body, `${metric}: ${snippet}`).toContain(snippet);
      }
    }

    expect(body).toContain("AND NOT public.has_role(bo.owner_id, 'admin')");
    expect(body).toContain("249900");
  });

  it("lists, alerts, recent-activity sources, and health omit admin-owned rows", () => {
    expect(functionBody("admin_centres_list")).toContain(
      "WHERE NOT public.has_role(i.owner_id, 'admin')",
    );
    expect(functionBody("admin_centres_list")).toContain(
      "AND NOT public.has_role(bo.owner_id, 'admin')",
    );
    expect(functionBody("admin_users_list")).toContain(
      "WHERE NOT public.has_role(u.id, 'admin')",
    );
    expect(functionBody("admin_users_list")).toContain(
      "WHERE NOT public.has_role(wm.owner_id, 'admin')",
    );
    expect(functionBody("admin_payments_list")).toContain(
      "WHERE NOT public.has_role(bo.owner_id, 'admin')",
    );
    expect(functionBody("admin_user_detail")).toContain(
      "AND NOT public.has_role(au.id, 'admin')",
    );
    expect(functionBody("admin_institute_health_summary")).toContain(
      "WHERE NOT public.has_role(i.owner_id, 'admin')",
    );

    const alerts = functionBody("admin_alerts");
    expect(alerts).toContain("AND NOT public.has_role(bo.owner_id, 'admin')");
    expect(alerts).toContain("AND NOT public.has_role(d.owner_id, 'admin')");
    expect(alerts).toContain("AND NOT public.has_role(i.owner_id, 'admin')");
    expect(alerts).toContain("AND NOT public.has_role(u.id, 'admin')");
  });
});

describe("founder metrics drop admin Pro ₹2,499 and every other admin row", () => {
  it("does not offer a Platform admin user filter", () => {
    expect(USER_FILTERS.map((c) => c.id)).toEqual([
      "all",
      "owners",
      "staff",
      "orphan",
      "unconfirmed",
    ]);
  });

  it("drops platform-admin rows from lists and page totals", () => {
    const admin = { user_id: "a", platform_admin: true };
    const owner = { user_id: "b", platform_admin: false };
    expect(isPlatformAdminRow(admin)).toBe(true);
    expect(isPlatformAdminRow(owner)).toBe(false);
    expect(excludePlatformAdminRows([admin, owner])).toEqual([owner]);
    expect(
      excludePlatformAdminsFromPage({ total: 3, rows: [admin, owner] }),
    ).toEqual({ total: 2, rows: [owner] });
  });

  it("excludes the admin Pro plan from MRR, paying, centres, revenue, and trials", () => {
    expect(paiseToRupees(ADMIN_LIST_PRICE_PAISE.pro.monthly)).toBe(2499);

    const onlyAdmin = founderOverviewFromFacts(
      {
        centres: [adminPro, adminTrial],
        users: [adminUser],
        payments: [adminPayment],
        alerts: [
          { ownerId: ADMIN, platformAdminOwner: true, kind: "over_limit" },
        ],
      },
      now,
    );
    expect(onlyAdmin.centres).toBe(0);
    expect(onlyAdmin.users).toBe(0);
    expect(onlyAdmin.paying).toBe(0);
    expect(onlyAdmin.mrr_paise).toBe(0);
    expect(onlyAdmin.revenue_30d_paise).toBe(0);
    expect(onlyAdmin.trials).toBe(0);
    expect(onlyAdmin.alerts).toBe(0);
    expect(onlyAdmin.recent_activity).toBe(0);
    expect(paiseToRupees(onlyAdmin.mrr_paise)).not.toBe(2499);

    const mixed = founderOverviewFromFacts(
      {
        centres: [adminPro, adminTrial, customerStarter, customerTrial],
        users: [adminUser, customerUser, newCustomerUser],
        payments: [adminPayment, customerPayment],
        alerts: [
          { ownerId: ADMIN, platformAdminOwner: true, kind: "over_limit" },
          { ownerId: CUSTOMER, platformAdminOwner: false, kind: "expiring" },
        ],
        trendDays: ["2026-10-12", "2026-10-13"],
      },
      now,
    );

    expect(mixed.centres).toBe(2);
    expect(mixed.users).toBe(2);
    expect(mixed.paying).toBe(1);
    expect(mixed.mrr_paise).toBe(ADMIN_LIST_PRICE_PAISE.starter.monthly);
    expect(paiseToRupees(mixed.mrr_paise)).toBe(499);
    expect(paiseToRupees(mixed.mrr_paise)).not.toBe(2499);
    expect(mixed.revenue_30d_paise).toBe(
      ADMIN_LIST_PRICE_PAISE.starter.monthly,
    );
    expect(mixed.trials).toBe(1);
    expect(mixed.alerts).toBe(1);
    expect(mixed.active_users_7d).toBe(1);
    expect(mixed.active_users_30d).toBe(1);
    expect(mixed.signups_7d).toBe(1);
    expect(mixed.signups_30d).toBe(1);
    expect(mixed.centre_signups_7d).toBe(1);
    expect(mixed.centre_signups_30d).toBe(1);
    expect(mixed.recent_activity).toBe(2);
    expect(mixed.signup_trend).toEqual([
      { day: "2026-10-12", users: 1, centres: 0 },
      { day: "2026-10-13", users: 0, centres: 0 },
    ]);
  });

  it("keeps admin sign-ups and last-active out of charts and recent activity", () => {
    const trend = founderOverviewFromFacts(
      {
        centres: [adminPro],
        users: [adminUser],
        payments: [],
        trendDays: ["2026-10-12"],
      },
      now,
    );
    expect(trend.signup_trend).toEqual([
      { day: "2026-10-12", users: 0, centres: 0 },
    ]);
    expect(trend.signups_7d).toBe(0);
    expect(trend.centre_signups_7d).toBe(0);
    expect(trend.active_users_7d).toBe(0);
    expect(trend.recent_activity).toBe(0);
  });
});
