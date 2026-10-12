import { describe, expect, it } from "vitest";
import {
  buildAttendanceSaveRows,
  leftoverAfterDeleteThenInsertFail,
  leftoverAfterUpsertThenScopedDelete,
  planAttendanceSave,
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

describe("atomic attendance save (VO-069)", () => {
  const existing = [
    { student_id: "a", status: "present" as const },
    { student_id: "b", status: "absent" as const },
  ];

  it("delete-then-insert loses the session if the insert fails", () => {
    expect(leftoverAfterDeleteThenInsertFail(existing, false, [])).toEqual([]);
  });

  it("upsert then scoped delete keeps previous rows if upsert fails", () => {
    const plan = planAttendanceSave(
      roster,
      { a: "late" },
      ctx,
      existing.map((row) => row.student_id),
    );
    expect(plan.upsertRows).toEqual([
      {
        owner_id: "owner-1",
        session_id: "session-1",
        student_id: "a",
        status: "late",
      },
    ]);
    expect(plan.deleteStudentIds).toEqual(["b"]);
    expect(
      leftoverAfterUpsertThenScopedDelete(
        existing,
        {
          upsertRows: plan.upsertRows.map((row) => ({
            student_id: row.student_id,
            status: row.status,
          })),
          deleteStudentIds: plan.deleteStudentIds,
        },
        false,
      ),
    ).toEqual(existing);
  });
});
