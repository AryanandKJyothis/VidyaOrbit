import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CAPTURE =
  "supabase/migrations/20261012100000_capture_live_institutes_upi_vpa.sql";

describe("VO-021 live UPI migration capture", () => {
  it("is missing from recorded history before this file exists", () => {
    const versions = readdirSync("supabase/migrations")
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const beforeCapture = versions.filter((name) => name < "20261012100000");
    expect(beforeCapture.at(-1)?.startsWith("20261011")).toBe(true);
    expect(existsSync(CAPTURE)).toBe(true);
  });

  it("is idempotent and matches live column, grants, and settings:write RLS", () => {
    const sql = readFileSync(CAPTURE, "utf8");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS upi_vpa text/);
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, REFERENCES \(upi_vpa\) ON public\.institutes TO authenticated/,
    );
    expect(sql).toMatch(
      /GRANT REFERENCES \(upi_vpa\) ON public\.institutes TO anon/,
    );
    expect(sql).toContain("policyname = 'inst_update'");
    expect(sql).toContain(
      "has_resource_access(owner_id, auth.uid(), 'settings', true)",
    );
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bDROP COLUMN\b/i);
    expect(sql).not.toMatch(/\bUPDATE public\.institutes\b/i);
    expect(sql).not.toMatch(/\bCREATE OR REPLACE FUNCTION\b/i);
  });
});
