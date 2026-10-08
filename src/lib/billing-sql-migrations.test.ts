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
const unlimited093000 = readFileSync(
  "supabase/migrations/20261008093000_pro_plan_unlimited.sql",
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

function activateBody(sql: string) {
  const start = sql.indexOf(
    "CREATE OR REPLACE FUNCTION public.activate_billing_order",
  );
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start);
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
    expect(health094000).not.toMatch(
      /UPDATE public\.subscriptions\s+SET setup_fee_paid = false/,
    );
    expect(health094000).not.toMatch(
      /UPDATE public\.subscriptions\s+SET setup_fee_paid = true\s*;/,
    );
    expect(health094000).not.toMatch(
      /SET setup_fee_paid = true\s+WHERE plan IS DISTINCT FROM 'free'/,
    );
    const health = subscriptionHealthBody(health094000);
    expect(health).not.toMatch(
      /v_setup_paid :=[\s\S]*plan IS DISTINCT FROM 'free'/,
    );
    expect(health).not.toMatch(/v_setup_paid :=[\s\S]*expiry_date IS NOT NULL/);
    expect(health).toMatch(/bo\.activated_at IS NOT NULL/);
    expect(health).not.toMatch(/li->>'item' = 'setup_fee'/);
    expect(health094000).toMatch(
      /UPDATE public\.subscriptions\s+SET setup_fee_paid = true\s+WHERE owner_id = o\.owner_id/,
    );
  });

  it("094000 A/B race: later setup capture is applied and flagged setup_already_paid", () => {
    const activate = activateBody(health094000);
    expect(activate).toContain("setup_already_paid");
    expect(activate).toMatch(/bo\.id IS DISTINCT FROM o\.id/);
    expect(activate).toMatch(/v_setup_in_order AND v_setup_already/);
    const applyAt = activate.indexOf("public.apply_subscription_change");
    expect(applyAt).toBeGreaterThan(-1);
    const afterApply = activate.slice(applyAt);
    expect(afterApply).toMatch(/SET setup_fee_paid = true/);
    expect(afterApply).toMatch(/needs_review = true/);
    expect(afterApply).toContain("setup_already_paid");
    expect(afterApply).toMatch(
      /'activated',\s*true[\s\S]*'reason',\s*'setup_already_paid'/,
    );
  });

  it("094000 sets setup_fee_paid after apply_subscription_change", () => {
    const activate = activateBody(health094000);
    const applyAt = activate.indexOf(
      "v_res := public.apply_subscription_change",
    );
    expect(applyAt).toBeGreaterThan(-1);
    expect(activate.slice(applyAt)).toMatch(
      /SET setup_fee_paid = true\s+WHERE owner_id = o\.owner_id/,
    );
    expect(health091700).toMatch(
      /INSERT INTO public\.subscriptions \(owner_id, plan, status/,
    );
    expect(health091700).not.toMatch(
      /INSERT INTO public\.subscriptions \([^;]*setup_fee_paid/,
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

  it("093000 is CREATE OR REPLACE and safe to re-run", () => {
    expect(unlimited093000).toMatch(
      /CREATE OR REPLACE FUNCTION public\.plan_student_limit/,
    );
    expect(unlimited093000).toContain("WHEN 'pro' THEN 2147483647");
    expect(unlimited093000).not.toMatch(/\bDROP FUNCTION\b/i);
    expect(unlimited093000).not.toMatch(/\bALTER FUNCTION\b/i);
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
