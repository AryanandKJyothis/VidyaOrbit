import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PUBLIC_RECEIPT_KEYS,
  PUBLIC_REPORT_KEYS,
  PUBLIC_SHARE_FORBIDDEN_KEYS,
} from "./share-links";

const PATH =
  "supabase/migrations/20261015120000_shareable_receipts_and_reports.sql";
const sql = readFileSync(PATH, "utf8");

function functionBody(name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThan(-1);
  const next = sql.indexOf("CREATE OR REPLACE FUNCTION public.", start + 10);
  return next === -1 ? sql.slice(start) : sql.slice(start, next);
}

describe("shareable receipt and report migration lock", () => {
  it("tells operators not to apply it from the agent or to prod", () => {
    expect(sql).toMatch(/DO NOT apply/i);
    expect(sql).toMatch(/Do not apply to prod/i);
  });

  it("mints unguessable tokens, never a sequential id", () => {
    const body = functionBody("generate_share_token");
    expect(body).toMatch(/gen_random_bytes\(24\)|gen_random_uuid/);
    expect(body).not.toMatch(/nextval|serial|receipt_counters/);
    expect(sql).toContain("CONSTRAINT receipt_shares_token_len CHECK");
    expect(sql).toContain("char_length(share_token) >= 32");
  });

  it("does not open table RLS to anon", () => {
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.receipt_shares FROM PUBLIC, anon",
    );
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.report_shares FROM PUBLIC, anon",
    );
    expect(sql).not.toMatch(/GRANT\s+(SELECT|ALL).+receipt_shares.+TO\s+anon/i);
    expect(sql).not.toMatch(/GRANT\s+(SELECT|ALL).+report_shares.+TO\s+anon/i);
    expect(sql).not.toMatch(
      /CREATE POLICY \S+_select ON public\.(receipt_shares|report_shares)[\s\S]{0,80}anon/,
    );
    expect(sql).toContain(
      "USING (public.has_resource_access(owner_id, auth.uid(), 'fees', false))",
    );
  });

  it("serves public pages through SECURITY DEFINER RPCs granted to anon", () => {
    for (const name of ["get_public_receipt", "get_public_report"]) {
      const body = functionBody(name);
      expect(body).toContain("SECURITY DEFINER");
      expect(body).toContain("SET search_path = public");
      expect(sql).toContain(
        `GRANT EXECUTE ON FUNCTION public.${name}(text) TO anon, authenticated, service_role`,
      );
    }
  });

  it("receipt RPC returns only the allowlist and never phones", () => {
    const body = functionBody("get_public_receipt");
    for (const key of PUBLIC_RECEIPT_KEYS) {
      if (key === "ok") continue;
      expect(body).toContain(`'${key}'`);
    }
    for (const key of PUBLIC_SHARE_FORBIDDEN_KEYS) {
      expect(body).not.toContain(`'${key}'`);
    }
    expect(body).toContain("reason', 'revoked'");
    expect(body).not.toContain("guardian_phone");
    expect(body).not.toContain("contact_phone");
  });

  it("report RPC returns only the allowlist and never phones", () => {
    const body = functionBody("get_public_report");
    for (const key of PUBLIC_REPORT_KEYS) {
      if (key === "ok") continue;
      expect(body).toContain(`'${key}'`);
    }
    for (const key of PUBLIC_SHARE_FORBIDDEN_KEYS) {
      expect(body).not.toContain(`'${key}'`);
    }
    expect(body).toContain("reason', 'revoked'");
  });

  it("lets fees:write rotate a receipt link and attendance:write rotate a report", () => {
    expect(functionBody("issue_receipt_share")).toContain(
      "has_resource_access(pay.owner_id, auth.uid(), 'fees', true)",
    );
    expect(functionBody("regenerate_receipt_share")).toContain(
      "has_resource_access(pay.owner_id, auth.uid(), 'fees', true)",
    );
    expect(functionBody("revoke_report_share")).toContain(
      "has_resource_access(stu.owner_id, auth.uid(), 'attendance', true)",
    );
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.issue_receipt_share(uuid) FROM PUBLIC, anon",
    );
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.issue_report_share(uuid, date, text) FROM PUBLIC, anon",
    );
  });
});
