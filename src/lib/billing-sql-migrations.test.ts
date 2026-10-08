import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const health091700 = readFileSync(
  "supabase/migrations/20261008091700_fix_enforce_student_limit_exclude_archived.sql",
  "utf8",
);
const health094000 = readFileSync(
  "supabase/migrations/20261008094000_atomic_billing_activation.sql",
  "utf8",
);
const revoke095000 = readFileSync(
  "supabase/migrations/20261008095000_revoke_client_writes_subscriptions.sql",
  "utf8",
);

function subscriptionHealthBody(sql: string) {
  const start = sql.indexOf(
    "CREATE OR REPLACE FUNCTION public.subscription_health",
  );
  expect(start).toBeGreaterThan(-1);
  const next = sql.indexOf("CREATE OR REPLACE FUNCTION public.", start + 10);
  return next === -1 ? sql.slice(start) : sql.slice(start, next);
}

describe("billing SQL migrations", () => {
  it.each([
    ["091700", health091700],
    ["094000", health094000],
  ])(
    "%s subscription_health restores workspace-member + service_role guard",
    (_label, sql) => {
      const body = subscriptionHealthBody(sql);
      expect(body).toContain("auth.role() IS DISTINCT FROM 'service_role'");
      expect(body).toContain("auth.uid() IS NULL");
      expect(body).toContain("auth.uid() IS DISTINCT FROM _uid");
      expect(body).toContain("public.is_workspace_member(_uid, auth.uid())");
      expect(body).not.toMatch(
        /auth\.role\(\) <> 'service_role' AND _uid IS DISTINCT FROM auth\.uid\(\)/,
      );
    },
  );

  it("094000 setup_fee_paid is only real payments, not non-free/expiry", () => {
    expect(health094000).toMatch(
      /UPDATE public\.subscriptions\s+SET setup_fee_paid = false/,
    );
    expect(health094000).not.toMatch(
      /SET setup_fee_paid = true\s+WHERE plan IS DISTINCT FROM 'free'/,
    );
    const health = subscriptionHealthBody(health094000);
    expect(health).not.toMatch(
      /v_setup_paid :=[\s\S]*plan IS DISTINCT FROM 'free'/,
    );
    expect(health).not.toMatch(/v_setup_paid :=[\s\S]*expiry_date IS NOT NULL/);
    expect(health).toContain("li->>'item' = 'setup_fee'");
    expect(health094000).toMatch(
      /jsonb_array_elements\(COALESCE\(o\.line_items[\s\S]*setup_fee[\s\S]*SET setup_fee_paid = true/,
    );
  });

  it("094000 hold branch marks needs_review and returns it on already_activated", () => {
    expect(health094000).toContain("tier_change_needs_review");
    expect(health094000).toContain("needs_review = true");
    expect(health094000).toMatch(
      /reason',\s*'already_activated'[\s\S]*needs_review',\s*COALESCE\(existing_order\.needs_review/,
    );
  });

  it("095000 revokes client writes on subscriptions and keeps SELECT", () => {
    expect(revoke095000).toMatch(
      /REVOKE INSERT,\s*UPDATE,\s*DELETE,\s*TRUNCATE ON public\.subscriptions FROM anon,\s*authenticated/,
    );
    expect(revoke095000).not.toMatch(/REVOKE SELECT/);
  });

  it("091700 COMMENT escapes the owner's apostrophe", () => {
    expect(health091700).not.toMatch(/the owner's plan/);
    expect(health091700).toContain("the owner''s plan");
  });

  it("091700 excludes archived students from admin/apply counts", () => {
    expect(health091700).toContain(
      "COUNT(*) FILTER (WHERE st.status IS DISTINCT FROM 'archived')",
    );
    expect(health091700).toContain(
      "FROM public.students WHERE owner_id = _owner AND status IS DISTINCT FROM 'archived'",
    );
    expect(health091700).toContain(
      "FROM public.students WHERE owner_id=_owner AND status IS DISTINCT FROM 'archived'",
    );
    expect(health091700).toContain(
      "IF auth.role() IS DISTINCT FROM 'service_role' THEN\n    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN\n      RAISE EXCEPTION 'Forbidden: admin only' USING ERRCODE = '42501';",
    );
  });
});
