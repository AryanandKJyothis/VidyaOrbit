import {
  parseOpenedReminderKeys,
  serializeOpenedReminderKeys,
} from "@/lib/fee-reminder";
import { renderAbsenceTemplate } from "@/lib/messaging/templates";
import { buildAssistedWhatsAppHref } from "@/lib/messaging/wa-me";
import { resolveParentWhatsAppPhone } from "@/lib/messaging/phone";

export const ABSENTEE_SENT_STORAGE_KEY = "vidya:absentees:sent";

export type AbsenteeRecord = {
  student_id: string;
  status: string;
  session_date: string;
  batch_id: string | null;
};

export type AbsenteeStudent = {
  id: string;
  full_name: string;
  batch_id: string | null;
  guardian_phone: string | null;
  phone: string | null;
  status: string;
};

export type AbsenteeRow = {
  studentId: string;
  studentName: string;
  batchId: string | null;
  batchName: string;
  guardianPhone: string | null;
  studentPhone: string | null;
};

export type AbsenteeGroup = {
  batchId: string;
  batchName: string;
  students: AbsenteeRow[];
};

export function absenteeSentKey(studentId: string, date: string): string {
  return `${studentId}:${date.slice(0, 10)}`;
}

export function parseSentAbsenteeKeys(
  raw: string | null | undefined,
): Set<string> {
  return parseOpenedReminderKeys(raw);
}

export function serializeSentAbsenteeKeys(keys: Iterable<string>): string {
  return serializeOpenedReminderKeys(keys);
}

export function markAbsenteeSent(
  keys: Set<string>,
  studentId: string,
  date: string,
): Set<string> {
  const next = new Set(keys);
  next.add(absenteeSentKey(studentId, date));
  return next;
}

export function groupTodaysAbsentees(input: {
  records: AbsenteeRecord[];
  students: AbsenteeStudent[];
  batches: { id: string; name: string }[];
  today: string;
}): AbsenteeGroup[] {
  const day = input.today.slice(0, 10);
  const studentById = new Map(input.students.map((s) => [s.id, s]));
  const batchName = new Map(input.batches.map((b) => [b.id, b.name]));
  const grouped = new Map<string, AbsenteeRow[]>();

  for (const rec of input.records) {
    if (rec.status !== "absent") continue;
    if (rec.session_date.slice(0, 10) !== day) continue;
    const student = studentById.get(rec.student_id);
    if (!student || student.status === "archived") continue;
    const batchId = rec.batch_id ?? student.batch_id ?? "none";
    const row: AbsenteeRow = {
      studentId: student.id,
      studentName: student.full_name,
      batchId: batchId === "none" ? null : batchId,
      batchName: batchName.get(batchId) ?? "No batch",
      guardianPhone: student.guardian_phone,
      studentPhone: student.phone,
    };
    const list = grouped.get(batchId) ?? [];
    if (!list.some((item) => item.studentId === row.studentId)) {
      list.push(row);
    }
    grouped.set(batchId, list);
  }

  return [...grouped.entries()]
    .map(([batchId, students]) => ({
      batchId,
      batchName: students[0]?.batchName ?? "No batch",
      students: students.sort((a, b) =>
        a.studentName.localeCompare(b.studentName, "en"),
      ),
    }))
    .sort((a, b) => a.batchName.localeCompare(b.batchName, "en"));
}

export function buildAbsenteeMessage(input: {
  studentName: string;
  centreName: string;
  sessionDate: string;
  batchName: string;
  guardianPhone?: string | null;
  studentPhone?: string | null;
}): { message: string; href: string | null } {
  const { body } = renderAbsenceTemplate({
    studentName: input.studentName,
    centreName: input.centreName,
    sessionDate: input.sessionDate,
    batchName: input.batchName,
  });
  const phone = resolveParentWhatsAppPhone({
    guardian_phone: input.guardianPhone,
    phone: input.studentPhone,
  });
  return {
    message: body,
    href: buildAssistedWhatsAppHref(phone?.e164 ?? null, body),
  };
}

export function canMessageAbsentees(
  messages: "none" | "read" | "write" | boolean | undefined,
): boolean {
  return messages === true || messages === "write";
}
