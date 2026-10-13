import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const viewSql = readFileSync(
  "supabase/migrations/20261008074500_gate_student_fee_amounts_3a_view.sql",
  "utf8",
);

describe("students_gated isolation predicate (VO-022)", () => {
  it("would leak if the WHERE helper were dropped", () => {
    const withoutWhere = viewSql.replace(
      /WHERE public\.has_resource_access\([^;]+;/s,
      ";",
    );
    expect(withoutWhere).not.toMatch(
      /WHERE public\.has_resource_access\(s\.owner_id, auth\.uid\(\), 'students'/,
    );
  });

  it("keeps the isolation WHERE and fee-column helper", () => {
    expect(viewSql).toMatch(
      /WHERE public\.has_resource_access\(s\.owner_id, auth\.uid\(\), 'students', false\)/,
    );
    expect(viewSql).toContain(
      "has_resource_access(s.owner_id, auth.uid(), 'fees', false)",
    );
    expect(viewSql).toContain("security_barrier=true");
  });
});
