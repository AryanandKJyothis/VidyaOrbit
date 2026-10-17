import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20261012130000_revoke_unused_definer_rpcs.sql",
  "utf8",
);

describe("revoke unused definer RPCs (VO-046)", () => {
  it("authenticated could EXECUTE has_role before the revoke", () => {
    const grant = readFileSync(
      "supabase/migrations/20260613090000_harden_security_definer_rpc.sql",
      "utf8",
    );
    expect(grant).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.has_role\([^)]+\) TO authenticated/,
    );
  });

  it("revokes the unused helpers and keeps has_resource_access", () => {
    expect(sql).toContain("Do NOT apply from this PR");
    expect(sql).toContain("'has_role'");
    expect(sql).toContain("'current_user_is_admin'");
    expect(sql).toContain("'get_user_emails'");
    expect(sql).toContain("'get_my_institute_id'");
    expect(sql).toContain("'is_institute_owner'");
    expect(sql).toContain("REVOKE ALL ON FUNCTION");
    expect(sql).not.toContain("'has_resource_access'");
  });
});
