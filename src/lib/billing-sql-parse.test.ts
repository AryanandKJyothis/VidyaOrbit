import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "libpg-query";

/** Migrations this PR adds (must stay in lockstep with git vs origin/master). */
const PR_MIGRATIONS = [
  "20261008091700_fix_enforce_student_limit_exclude_archived.sql",
  "20261008091800_create_billing_orders_table.sql",
  "20261008093000_pro_plan_unlimited.sql",
  "20261008094000_atomic_billing_activation.sql",
] as const;

const MIGRATIONS_DIR = "supabase/migrations";

describe("PR SQL migrations parse with libpg-query", () => {
  it("covers every migration file this PR adds", () => {
    const onDisk = readdirSync(MIGRATIONS_DIR).filter((f) =>
      f.endsWith(".sql"),
    );
    for (const name of PR_MIGRATIONS) {
      expect(onDisk, `missing ${name}`).toContain(name);
    }
  });

  it.each(PR_MIGRATIONS)("parses every statement in %s", async (name) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, name), "utf8");
    const result = await parse(sql);
    const stmts = result.stmts ?? [];
    expect(stmts.length, `${name} produced no statements`).toBeGreaterThan(0);
    for (const [i, stmt] of stmts.entries()) {
      expect(stmt.stmt, `${name} statement ${i} is empty`).toBeTruthy();
    }
  });

  it("rejects COMMENT strings with an unescaped apostrophe", async () => {
    await expect(
      parse("COMMENT ON FUNCTION public.foo() IS 'the owner's x';"),
    ).rejects.toThrow(/syntax error at or near "s"/i);
    const ok = await parse(
      "COMMENT ON FUNCTION public.foo() IS 'the owner''s x';",
    );
    expect(ok.stmts).toHaveLength(1);
  });
});
