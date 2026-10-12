import { describe, expect, it } from "vitest";
import {
  buildAttendanceSaveRows,
  resolveAttendanceDate,
  summarizeAttendanceMarks,
  type AttendanceStatus,
} from "./attendance";

const roster = [{ id: "a" }, { id: "b" }, { id: "c" }];
const ctx = { ownerId: "owner-1", sessionId: "session-1" };

/** The save path before VO-012: unmarked students were written as present. */
function buildAttendanceSaveRowsBeforeFix(
  students: { id: string }[],
  marks: Record<string, AttendanceStatus>,
  ownerId: string,
  sessionId: string,
) {
  return students.map((s) => ({
    owner_id: ownerId,
    session_id: sessionId,
    student_id: s.id,
    status: marks[s.id] ?? "present",
  }));
}

describe("buildAttendanceSaveRows", () => {
  it("does not record unmarked students as present", () => {
    const marks: Record<string, AttendanceStatus> = {};
    const before = buildAttendanceSaveRowsBeforeFix(
      roster,
      marks,
      ctx.ownerId,
      ctx.sessionId,
    );
    expect(before).toHaveLength(3);
    expect(before.every((row) => row.status === "present")).toBe(true);

    const after = buildAttendanceSaveRows(roster, marks, ctx);
    expect(after).toEqual([]);
  });

  it("persists only students with an explicit mark", () => {
    const marks: Record<string, AttendanceStatus> = {
      a: "present",
      c: "absent",
    };
    expect(buildAttendanceSaveRows(roster, marks, ctx)).toEqual([
      {
        owner_id: "owner-1",
        session_id: "session-1",
        student_id: "a",
        status: "present",
      },
      {
        owner_id: "owner-1",
        session_id: "session-1",
        student_id: "c",
        status: "absent",
      },
    ]);
  });

  it("keeps an All-present mark as explicit presents", () => {
    const marks: Record<string, AttendanceStatus> = {
      a: "present",
      b: "present",
      c: "present",
    };
    const rows = buildAttendanceSaveRows(roster, marks, ctx);
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.status === "present")).toBe(true);
  });
});

describe("summarizeAttendanceMarks", () => {
  it("does not count unmarked students as present", () => {
    const marks: Record<string, AttendanceStatus> = { b: "late" };
    expect(summarizeAttendanceMarks(roster, marks)).toEqual({
      present: 0,
      absent: 0,
      late: 1,
      unmarked: 2,
    });
  });
});

describe("resolveAttendanceDate (VO-026)", () => {
  it("restored yesterday from localStorage before the same-day guard", () => {
    const today = "2026-10-12";
    const saved = "2026-10-11";
    const before = saved;
    expect(before).toBe("2026-10-11");
    expect(resolveAttendanceDate(saved, today)).toBe(today);
  });

  it("keeps a stored date only when it is still today", () => {
    expect(resolveAttendanceDate("2026-10-12", "2026-10-12")).toBe(
      "2026-10-12",
    );
    expect(resolveAttendanceDate("not-a-date", "2026-10-12")).toBe(
      "2026-10-12",
    );
  });
});
