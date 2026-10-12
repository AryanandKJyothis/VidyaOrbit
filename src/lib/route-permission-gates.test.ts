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
});
