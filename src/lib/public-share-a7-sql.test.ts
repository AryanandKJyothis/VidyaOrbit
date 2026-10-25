import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PUBLIC_RECEIPT_KEYS,
  PUBLIC_REPORT_KEYS,
  PUBLIC_SHARE_FORBIDDEN_KEYS,
} from "./share-links";

const PATH = "supabase/migrations/20261025100000_harden_public_share_links.sql";
const sql = readFileSync(PATH, "utf8");

function functionBody(name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThan(-1);
  const next = sql.indexOf("CREATE OR REPLACE FUNCTION public.", start + 10);
  return next === -1 ? sql.slice(start) : sql.slice(start, next);
}

describe("A7 public share hardening migration lock", () => {
  it("tells operators not to apply it from the agent or to prod", () => {
    expect(sql).toMatch(/DO NOT apply/i);
    expect(sql).toMatch(/Do not apply to prod/i);
  });

  it("adds 180-day expiry and resets it on regenerate", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS expires_at timestamptz");
    expect(sql).toContain("created_at + interval '180 days'");
    expect(sql).toContain("now() + interval '180 days'");
    expect(functionBody("regenerate_receipt_share")).toContain(
      "expires_at = EXCLUDED.expires_at",
    );
    expect(functionBody("regenerate_report_share")).toContain(
      "expires_at = EXCLUDED.expires_at",
    );
  });

  it("logs hashed token/IP/UA and never stores the raw token", () => {
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS public.public_share_access_log",
    );
    expect(sql).toContain("token_hash text NOT NULL");
    expect(sql).toContain("ip_hash text NOT NULL");
    expect(sql).toContain("ua_hash text NOT NULL");
    expect(sql).toContain(
      "result IN ('ok', 'not_found', 'revoked', 'expired', 'rate_limited')",
    );
    expect(sql).toContain("share_access_hash");
    expect(sql).toContain("public_share_access_log is append-only");
    expect(sql).toContain("must be kept for 90 days");
    expect(sql).toContain("_token_hash,");
    expect(sql).not.toMatch(
      /INSERT INTO public\.public_share_access_log \([^)]*\btoken[^_]/,
    );
  });

  it("keeps raw access logs off authenticated clients", () => {
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.public_share_access_log FROM PUBLIC, anon, authenticated",
    );
    expect(sql).not.toMatch(
      /GRANT\s+(SELECT|ALL).+public_share_access_log.+TO\s+(anon|authenticated)/i,
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.public_share_access_summary(uuid, integer)",
    );
    expect(functionBody("public_share_access_summary")).toContain(
      "has_resource_access(v_owner, auth.uid(), 'fees', false)",
    );
    expect(functionBody("public_share_access_summary")).not.toContain(
      "token_hash",
    );
    expect(functionBody("public_share_access_summary")).not.toContain(
      "ip_hash",
    );
  });

  it("throttles public lookups in the RPC at 60/min/IP with a burst", () => {
    expect(sql).toContain("60 lookups / 60s / IP");
    expect(sql).toContain("20 lookups / 10s / IP");
    expect(functionBody("get_public_receipt")).toContain(
      "public_share_rate_allow",
    );
    expect(functionBody("get_public_report")).toContain(
      "public_share_rate_allow",
    );
    expect(functionBody("get_public_receipt")).toContain(
      "reason', 'unavailable'",
    );
    expect(functionBody("get_public_receipt")).not.toContain(
      "reason', 'rate_limited'",
    );
    expect(functionBody("get_public_receipt")).not.toContain(
      "reason', 'expired'",
    );
  });

  it("receipt RPC still returns only the allowlist and never phones", () => {
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

  it("report RPC still returns only the allowlist and never phones", () => {
    const body = functionBody("get_public_report");
    for (const key of PUBLIC_REPORT_KEYS) {
      if (key === "ok") continue;
      expect(body).toContain(`'${key}'`);
    }
    for (const key of PUBLIC_SHARE_FORBIDDEN_KEYS) {
      expect(body).not.toContain(`'${key}'`);
    }
  });
});
