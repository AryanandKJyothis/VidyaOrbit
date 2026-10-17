import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const versioned = readFileSync(
  "supabase/migrations/20261012120000_gate_student_fee_amounts_3b_revoke_trigger.sql",
  "utf8",
);
const manual = readFileSync(
  "supabase/manual/20261008074501_gate_student_fee_amounts_3b_revoke_trigger.sql",
  "utf8",
);

describe("fee-gate 3b versioned migration (VO-033)", () => {
  it("was only under supabase/manual before the fix", () => {
    expect(manual).toContain("validate_student_fee_write");
    expect(manual).toContain("trg_validate_student_fee_write");
  });

  it("promotes the live 3b trigger into versioned migrations", () => {
    expect(versioned).toContain(
      "CREATE OR REPLACE FUNCTION public.validate_student_fee_write",
    );
    expect(versioned).toContain(
      "CREATE TRIGGER trg_validate_student_fee_write",
    );
    expect(versioned).toContain("Do NOT apply from this PR");
  });
});
