export type AttendanceStatus = "present" | "absent" | "late";

export type AttendanceSaveRow = {
  owner_id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
};

export type AttendanceSummary = {
  present: number;
  absent: number;
  late: number;
  unmarked: number;
};

/** Only students the teacher explicitly marked are persisted. */
export function buildAttendanceSaveRows(
  roster: { id: string }[],
  marks: Record<string, AttendanceStatus>,
  ctx: { ownerId: string; sessionId: string },
): AttendanceSaveRow[] {
  const rows: AttendanceSaveRow[] = [];
  for (const student of roster) {
    const status = marks[student.id];
    if (!status) continue;
    rows.push({
      owner_id: ctx.ownerId,
      session_id: ctx.sessionId,
      student_id: student.id,
      status,
    });
  }
  return rows;
}

export function summarizeAttendanceMarks(
  roster: { id: string }[],
  marks: Record<string, AttendanceStatus>,
): AttendanceSummary {
  const summary: AttendanceSummary = {
    present: 0,
    absent: 0,
    late: 0,
    unmarked: 0,
  };
  for (const student of roster) {
    const status = marks[student.id];
    if (status === "present") summary.present += 1;
    else if (status === "absent") summary.absent += 1;
    else if (status === "late") summary.late += 1;
    else summary.unmarked += 1;
  }
  return summary;
}
