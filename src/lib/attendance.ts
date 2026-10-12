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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Keep a stored date only when it is still today (IST). */
export function resolveAttendanceDate(
  saved: string | null | undefined,
  today: string,
): string {
  if (saved && ISO_DATE.test(saved) && saved === today) return saved;
  return today;
}

export type AttendanceSavePlan = {
  upsertRows: AttendanceSaveRow[];
  deleteStudentIds: string[];
};

/**
 * Safe save: upsert marked rows, then delete only students who are no
 * longer marked. A failed upsert leaves the previous session intact.
 */
export function planAttendanceSave(
  roster: { id: string }[],
  marks: Record<string, AttendanceStatus>,
  ctx: { ownerId: string; sessionId: string },
  existingStudentIds: string[],
): AttendanceSavePlan {
  const upsertRows = buildAttendanceSaveRows(roster, marks, ctx);
  const marked = new Set(upsertRows.map((row) => row.student_id));
  return {
    upsertRows,
    deleteStudentIds: existingStudentIds.filter((id) => !marked.has(id)),
  };
}

/** The pre-#23 / VO-069 failure: delete-all then a failed insert wipes the session. */
export function leftoverAfterDeleteThenInsertFail<T>(
  _existing: T[],
  insertOk: boolean,
  inserted: T[],
): T[] {
  if (!insertOk) return [];
  return inserted;
}

export function leftoverAfterUpsertThenScopedDelete<
  T extends { student_id: string },
>(
  existing: T[],
  plan: { upsertRows: T[]; deleteStudentIds: string[] },
  upsertOk: boolean,
): T[] {
  if (!upsertOk) return existing;
  const deleted = new Set(plan.deleteStudentIds);
  const upsertedIds = new Set(plan.upsertRows.map((row) => row.student_id));
  return [
    ...existing.filter(
      (row) => !deleted.has(row.student_id) && !upsertedIds.has(row.student_id),
    ),
    ...plan.upsertRows,
  ];
}

export function isMissingAttendanceRpc(
  error: {
    code?: string;
    message?: string;
  } | null,
): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "42883" ||
    /could not find the function|does not exist/i.test(message)
  );
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
