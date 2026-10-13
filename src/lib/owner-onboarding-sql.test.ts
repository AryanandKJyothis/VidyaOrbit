import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PATH = "supabase/migrations/20261013140000_institute_centre_type.sql";
const sql = readFileSync(PATH, "utf8");

describe("institute centre_type migration lock", () => {
  it("is a single additive nullable column with a column-level grant, no data rewrite", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS centre_type text");
    expect(sql).toMatch(
      /GRANT SELECT, UPDATE \(centre_type\) ON public\.institutes TO authenticated/,
    );
    expect(sql).not.toMatch(/NOT NULL/);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bUPDATE public\./i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).toMatch(/DO NOT apply/i);
  });

  it("has no table-wide grant that would restore admin_notes", () => {
    expect(sql).not.toMatch(
      /GRANT\s+SELECT\s*,\s*INSERT\s*,\s*UPDATE\s+ON\s+public\.institutes/i,
    );
    expect(sql).not.toMatch(
      /GRANT\s+(ALL|SELECT|INSERT|UPDATE|DELETE)(\s*,\s*(ALL|SELECT|INSERT|UPDATE|DELETE))*\s+ON\s+TABLE\s+public\.institutes/i,
    );
    expect(sql).not.toMatch(
      /GRANT\s+ALL(\s+PRIVILEGES)?\s+ON\s+(TABLE\s+)?public\.institutes/i,
    );
  });

  it("does not touch billing, pricing, or permissions tables", () => {
    expect(sql).not.toMatch(
      /subscriptions|billing_orders|plan_code|workspace_members/i,
    );
  });
});

describe("centre_type is absent in the live app", () => {
  it("never selects or writes centre_type until the unused migration is applied", () => {
    const host = readFileSync(
      "src/components/owner-onboarding-host.tsx",
      "utf8",
    );
    const data = readFileSync("src/hooks/use-data.ts", "utf8");
    const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
    expect(host).not.toMatch(/centre_type/);
    expect(data).not.toMatch(/centre_type/);
    expect(types).not.toMatch(/centre_type/);
    expect(data).toContain(
      "id, owner_id, name, logo_url, contact_phone, contact_email, address, receipt_prefix, receipt_footer, upi_vpa, currency, timezone",
    );
  });
});
