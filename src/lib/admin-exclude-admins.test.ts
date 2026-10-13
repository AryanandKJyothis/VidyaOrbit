import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { USER_FILTERS } from "@/components/admin/admin-users-panel";
import {
  excludePlatformAdminRows,
  excludePlatformAdminsFromPage,
  isPlatformAdminRow,
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
] as const;

function functionBody(name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start).toBeGreaterThan(-1);
  const next = sql.indexOf("CREATE OR REPLACE FUNCTION public.", start + 10);
  return next === -1 ? sql.slice(start) : sql.slice(start, next);
}

describe("admin RPC migration excludes platform admins by role", () => {
  it("replaces the six founder-admin RPCs without writing data or hardcoding emails", () => {
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

  it("overview drops admin users, centres, payments, trials, and revenue", () => {
    const body = functionBody("admin_platform_overview");
    expect(body).toContain(
      "FROM public.institutes i\n    LEFT JOIN public.subscriptions s ON s.owner_id = i.owner_id\n    LEFT JOIN last_live ll ON ll.owner_id = i.owner_id\n    WHERE NOT public.has_role(i.owner_id, 'admin')",
    );
    expect(body).toContain(
      "'users', (SELECT COUNT(*) FROM auth.users u WHERE NOT public.has_role(u.id, 'admin'))",
    );
    expect(body).toContain(
      "'centres', (SELECT COUNT(*) FROM public.institutes i WHERE NOT public.has_role(i.owner_id, 'admin'))",
    );
    expect(body).toContain("AND NOT public.has_role(u.id, 'admin')) AS users");
    expect(body).toContain(
      "AND NOT public.has_role(i.owner_id, 'admin')) AS centres",
    );
    expect(body).toContain("AND NOT public.has_role(bo.owner_id, 'admin')");
    expect(body).toContain("'paying'");
    expect(body).toContain("'trials'");
    expect(body).toContain("'mrr_paise'");
    expect(body).toContain("'revenue_30d_paise'");
  });

  it("lists and alerts omit admin-owned centres, users, and payments", () => {
    expect(functionBody("admin_centres_list")).toContain(
      "WHERE NOT public.has_role(i.owner_id, 'admin')",
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

    const alerts = functionBody("admin_alerts");
    expect(alerts).toContain("AND NOT public.has_role(bo.owner_id, 'admin')");
    expect(alerts).toContain("AND NOT public.has_role(d.owner_id, 'admin')");
    expect(alerts).toContain("AND NOT public.has_role(i.owner_id, 'admin')");
    expect(alerts).toContain("AND NOT public.has_role(u.id, 'admin')");
  });
});

describe("admin UI and mapping exclude platform admins", () => {
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
});
