import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PATH = "supabase/migrations/20261013140000_institute_centre_type.sql";
const sql = readFileSync(PATH, "utf8");

describe("institute centre_type migration lock", () => {
  it("is a single additive nullable column with grants, no data rewrite", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS centre_type text");
    expect(sql).toMatch(
      /GRANT SELECT, UPDATE \(centre_type\) ON public\.institutes TO authenticated/,
    );
    expect(sql).toContain(
      "GRANT SELECT, INSERT, UPDATE ON public.institutes TO authenticated",
    );
    expect(sql).not.toMatch(/NOT NULL/);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bUPDATE public\./i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).toMatch(/DO NOT apply/i);
  });

  it("does not touch billing, pricing, or permissions tables", () => {
    expect(sql).not.toMatch(
      /subscriptions|billing_orders|plan_code|workspace_members/i,
    );
  });
});
