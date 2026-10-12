import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20261012140000_save_attendance_session_rpc.sql",
  "utf8",
);

describe("save_attendance_session RPC (VO-069)", () => {
  it("adds an unapplied transactional RPC and keeps a client fallback note", () => {
    expect(sql).toContain("Do NOT apply from this PR");
    expect(sql).toContain("ON CONFLICT (session_id, student_id)");
    expect(sql).toContain("has_resource_access");
    expect(sql).toContain("client has a safe fallback");
  });
});
