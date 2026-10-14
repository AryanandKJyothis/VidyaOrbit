import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MANAGER_PERMISSIONS_JSON,
  STAFF_PERMISSIONS_JSON,
} from "./workspace-roles";

const PATH = "supabase/migrations/20261014120000_workspace_staff_roles.sql";
const sql = readFileSync(PATH, "utf8");
const functionsSrc = readFileSync("src/lib/workspace.functions.ts", "utf8");
const teamSrc = readFileSync(
  "src/routes/_authenticated/settings.team.tsx",
  "utf8",
);
const planSrc = readFileSync("src/routes/_authenticated/plan.tsx", "utf8");
const studentsSrc = readFileSync(
  "src/routes/_authenticated/students.tsx",
  "utf8",
);

describe("workspace staff roles migration lock", () => {
  it("tells operators not to apply it from the agent", () => {
    expect(sql).toMatch(/DO NOT apply/i);
  });

  it("defines the privileged-role helper with the same uid guard as other DEFINER fns", () => {
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.has_privileged_workspace_role(_owner uuid, _uid uuid)",
    );
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = public");
    expect(sql).toContain(
      "IF auth.role() <> 'service_role' AND _uid IS DISTINCT FROM auth.uid() THEN",
    );
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.has_privileged_workspace_role(uuid, uuid) FROM PUBLIC, anon",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.has_privileged_workspace_role(uuid, uuid) TO authenticated, service_role",
    );
  });

  it("makes student DELETE owner-or-manager only", () => {
    expect(sql).toContain(
      "DROP POLICY IF EXISTS students_delete ON public.students",
    );
    expect(sql).toMatch(
      /CREATE POLICY students_delete ON public\.students[\s\S]*has_privileged_workspace_role\(owner_id, auth\.uid\(\)\)/,
    );
  });

  it("backfills staff and manager permission JSON to match the TypeScript presets", () => {
    expect(sql).toContain(STAFF_PERMISSIONS_JSON);
    expect(sql).toContain(MANAGER_PERMISSIONS_JSON);
    expect(sql).toMatch(/WHERE role = 'staff'[\s\S]*WHERE role = 'manager'/s);
  });

  it("does not grant client writes on workspace_members or invites", () => {
    expect(sql).not.toMatch(
      /GRANT\s+(ALL|INSERT|UPDATE|DELETE).*workspace_members/i,
    );
    expect(sql).not.toMatch(
      /GRANT\s+(ALL|INSERT|UPDATE|DELETE).*workspace_invites/i,
    );
  });
});

describe("server and UI enforce the three roles, not just hidden buttons", () => {
  it("invite and update RPCs overwrite permissions from the role preset", () => {
    expect(functionsSrc).toContain("permissionsForRole(data.role)");
    expect(functionsSrc).toContain("assertCanInviteRole");
    expect(functionsSrc).toContain("assertCanRemoveMember");
    expect(functionsSrc).toContain('z.enum(["manager", "staff"])');
    expect(functionsSrc).not.toMatch(
      /role:\s*z\.enum\(\["manager",\s*"staff",\s*"viewer"\]\)/,
    );
  });

  it("gates plan/billing and export by role, and shows Team to every member", () => {
    expect(planSrc).toContain('resource="billing"');
    expect(studentsSrc).toContain("useCanExport");
    expect(teamSrc).toContain("canManage");
    expect(teamSrc).toContain("ROLE_LABELS");
  });
});
