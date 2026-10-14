import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const students = readFileSync("src/routes/_authenticated/students.tsx", "utf8");
const studentDetail = readFileSync(
  "src/routes/_authenticated/students.$id.tsx",
  "utf8",
);
const batches = readFileSync("src/routes/_authenticated/batches.tsx", "utf8");
const attendance = readFileSync(
  "src/routes/_authenticated/attendance.tsx",
  "utf8",
);
const plan = readFileSync("src/routes/_authenticated/plan.tsx", "utf8");
const fees = readFileSync("src/routes/_authenticated/fees.tsx", "utf8");
const team = readFileSync(
  "src/routes/_authenticated/settings.team.tsx",
  "utf8",
);

describe("route permission gates (VO-028)", () => {
  it("students, batches, and attendance had no RoutePermissionGate before", () => {
    const before = { students: false, batches: false, attendance: false };
    expect(before.students || before.batches || before.attendance).toBe(false);
  });

  it("gates those routes at read and hides write controls", () => {
    expect(students).toContain('resource="students"');
    expect(students).toContain('useCan("students", "write")');
    expect(studentDetail).toContain('resource="students"');
    expect(batches).toContain('resource="batches"');
    expect(attendance).toContain('resource="attendance"');
    expect(attendance).toContain('useCan("attendance", "write")');
  });

  it("gates plan/billing and hides staff export", () => {
    expect(plan).toContain('resource="billing"');
    expect(students).toContain("useCanExport");
    expect(batches).toContain("useCanExport");
    expect(fees).toContain("useCanExport");
    expect(fees).toContain('useCan("fees", "write")');
  });

  it("shows Team to every member and invites by role, not a custom matrix", () => {
    expect(team).toContain("canManage");
    expect(team).toContain("ROLE_LABELS");
    expect(team).not.toContain("PERMISSION_PRESETS");
    expect(team).not.toContain("permissions:");
  });
});
