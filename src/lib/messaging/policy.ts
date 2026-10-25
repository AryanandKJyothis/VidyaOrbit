import type {
  AbsencePayload,
  FeeOverduePayload,
  FeePaidPayload,
  MessagingSettings,
  MessageOutboxRow,
  OutboxStatus,
  ResolvedParentPhone,
  SkipReason,
} from "./types";
import {
  DEFAULT_FEE_OVERDUE_DEDUPE_DAYS,
  DEFAULT_MESSAGING_SETTINGS,
  MAX_FEE_OVERDUE_DEDUPE_DAYS,
  MIN_FEE_OVERDUE_DEDUPE_DAYS,
} from "./types";
import {
  renderAbsenceTemplate,
  renderFeeOverdueTemplate,
  renderFeePaidTemplate,
} from "./templates";
import { publicReceiptUrl } from "@/lib/share-links";
import { SITE_URL } from "@/lib/site";
import { addCalendarDaysISO, todayISO } from "@/lib/format";
import { resolveParentWhatsAppPhone } from "./phone";

/** Absence uniqueness: one row per student per attendance session. */
export function absenceDedupeKey(sessionId: string, studentId: string): string {
  return `absence:${sessionId}:${studentId}`;
}

/** Fee-paid uniqueness: one ack row per payment. Webhook replay is a no-op. */
export function feePaidDedupeKey(paymentId: string): string {
  return `fee_paid:${paymentId}`;
}

/** Fee-overdue uniqueness: one row per student per IST calendar day. */
export function feeOverdueDedupeKey(studentId: string, dayISO: string): string {
  return `fee_overdue:${studentId}:${dayISO.slice(0, 10)}`;
}

export function normalizeFeeOverdueDedupeDays(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_FEE_OVERDUE_DEDUPE_DAYS;
  return Math.min(
    MAX_FEE_OVERDUE_DEDUPE_DAYS,
    Math.max(MIN_FEE_OVERDUE_DEDUPE_DAYS, Math.round(n)),
  );
}

export function normalizeMessagingSettings(
  raw: Partial<MessagingSettings> | null | undefined,
): MessagingSettings {
  return {
    waAuto: raw?.waAuto === true,
    locale: raw?.locale === "ml" ? "ml" : "en",
    feeOverdueDedupeDays: normalizeFeeOverdueDedupeDays(
      raw?.feeOverdueDedupeDays,
    ),
  };
}

export type PlannedAbsenceRow = {
  studentId: string;
  sessionId: string;
  sessionDate: string;
  kind: "absence";
  phone: string | null;
  body: string | null;
  status: "queued" | "skipped";
  skipReason: SkipReason | null;
  dedupeKey: string;
  payload: AbsencePayload;
};

export type AbsencePlan = {
  /** Inserts only — existing dedupe keys are never rewritten except flips. */
  inserts: PlannedAbsenceRow[];
  /** Queued rows to skip because the mark is no longer Absent. */
  skipDedupeKeys: string[];
};

export type AbsenceMark = {
  studentId: string;
  status: string;
  studentName: string;
  guardianPhone?: string | null;
  studentPhone?: string | null;
  phone: ResolvedParentPhone | null;
};

/**
 * AttendanceMarked(absent) → one outbox row per student per session.
 * Late is ignored. Re-save does not duplicate. Absent→Present/Late
 * before send marks the queued row skipped.
 */
export function planAbsenceOutbox(input: {
  sessionId: string;
  sessionDate: string;
  batchName: string;
  centreName: string;
  locale?: string;
  marks: AbsenceMark[];
  existing: Pick<MessageOutboxRow, "dedupe_key" | "status">[];
}): AbsencePlan {
  const existingByKey = new Map(
    input.existing.map((row) => [row.dedupe_key, row.status]),
  );
  const inserts: PlannedAbsenceRow[] = [];
  const skipDedupeKeys: string[] = [];

  for (const mark of input.marks) {
    const key = absenceDedupeKey(input.sessionId, mark.studentId);
    const existing = existingByKey.get(key) ?? null;
    const isAbsent = mark.status === "absent";

    if (!isAbsent) {
      if (existing === "queued") skipDedupeKeys.push(key);
      continue;
    }

    if (existing) continue;

    const phone = mark.phone;
    const rendered = renderAbsenceTemplate(
      {
        studentName: mark.studentName,
        centreName: input.centreName,
        sessionDate: input.sessionDate,
        batchName: input.batchName,
      },
      input.locale,
    );
    const payload: AbsencePayload = {
      studentName: mark.studentName,
      batchName: input.batchName,
      sessionDate: input.sessionDate,
      centreName: input.centreName,
      phoneSource: phone?.source ?? null,
    };

    if (!phone) {
      inserts.push({
        studentId: mark.studentId,
        sessionId: input.sessionId,
        sessionDate: input.sessionDate,
        kind: "absence",
        phone: null,
        body: rendered.body,
        status: "skipped",
        skipReason: "no_phone",
        dedupeKey: key,
        payload,
      });
      continue;
    }

    inserts.push({
      studentId: mark.studentId,
      sessionId: input.sessionId,
      sessionDate: input.sessionDate,
      kind: "absence",
      phone: phone.e164,
      body: rendered.body,
      status: "queued",
      skipReason: null,
      dedupeKey: key,
      payload,
    });
  }

  return { inserts, skipDedupeKeys };
}

export function summarizeAbsencePlan(
  plan: AbsencePlan,
  existing: Pick<MessageOutboxRow, "dedupe_key" | "status" | "skip_reason">[],
): {
  queued: number;
  skippedNoPhone: number;
  skippedNotAbsent: number;
  already: number;
} {
  const queued = plan.inserts.filter((row) => row.status === "queued").length;
  const skippedNoPhone = plan.inserts.filter(
    (row) => row.skipReason === "no_phone",
  ).length;
  const already = existing.filter((row) =>
    inputStillCounts(row, plan.skipDedupeKeys),
  ).length;
  return {
    queued,
    skippedNoPhone,
    skippedNotAbsent: plan.skipDedupeKeys.length,
    already,
  };
}

function inputStillCounts(
  row: Pick<MessageOutboxRow, "dedupe_key" | "status">,
  skipKeys: string[],
): boolean {
  if (skipKeys.includes(row.dedupe_key)) return false;
  return row.status === "queued" || row.status === "sent";
}

export function canMarkOutboxSent(status: OutboxStatus): boolean {
  return status === "queued" || status === "failed";
}

/** Assisted send is messages:write. fees:read alone is not enough. */
export function canSendFeePaidAck(
  messages: "none" | "read" | "write" | boolean | undefined,
): boolean {
  return messages === true || messages === "write";
}

export type PlannedFeePaidRow = {
  studentId: string;
  kind: "fee_paid";
  phone: string | null;
  body: string | null;
  status: "queued" | "skipped";
  skipReason: SkipReason | null;
  dedupeKey: string;
  payload: FeePaidPayload;
};

export type FeePaidPlan = {
  insert: PlannedFeePaidRow | null;
  already: boolean;
};

export function remainingFeeBalance(
  feeTotal: number,
  paidTotal: number,
): number {
  const total = Number.isFinite(feeTotal) ? feeTotal : 0;
  const paid = Number.isFinite(paidTotal) ? paidTotal : 0;
  return Math.max(0, total - paid);
}

/**
 * Recording a payment → one fee_paid outbox row.
 * Dedupe is payment_id, so a webhook replay never inserts a second row.
 */
export function planFeePaidOutbox(input: {
  paymentId: string;
  studentId: string;
  studentName: string;
  amount: number;
  paymentDate: string;
  receiptNumber: string | null;
  shareToken: string;
  feeTotal: number;
  paidTotal: number;
  locale?: string;
  phone: ResolvedParentPhone | null;
  existing: Pick<MessageOutboxRow, "dedupe_key" | "status">[];
}): FeePaidPlan {
  const key = feePaidDedupeKey(input.paymentId);
  if (input.existing.some((row) => row.dedupe_key === key)) {
    return { insert: null, already: true };
  }

  const balance = remainingFeeBalance(input.feeTotal, input.paidTotal);
  const rendered = renderFeePaidTemplate(
    {
      studentName: input.studentName,
      amount: input.amount,
      paymentDate: input.paymentDate,
      receiptNumber: input.receiptNumber,
      shareToken: input.shareToken,
      balance,
    },
    input.locale,
  );
  const payload: FeePaidPayload = {
    paymentId: input.paymentId,
    studentName: input.studentName,
    amount: input.amount,
    paymentDate: input.paymentDate,
    receiptNumber: input.receiptNumber,
    receiptUrl: publicReceiptUrl(input.shareToken, SITE_URL),
    shareToken: input.shareToken,
    balance,
    phoneSource: input.phone?.source ?? null,
  };

  if (!input.phone) {
    return {
      insert: {
        studentId: input.studentId,
        kind: "fee_paid",
        phone: null,
        body: rendered.body,
        status: "skipped",
        skipReason: "no_phone",
        dedupeKey: key,
        payload,
      },
      already: false,
    };
  }

  return {
    insert: {
      studentId: input.studentId,
      kind: "fee_paid",
      phone: input.phone.e164,
      body: rendered.body,
      status: "queued",
      skipReason: null,
      dedupeKey: key,
      payload,
    },
    already: false,
  };
}

export function settingsFromRow(
  row: {
    wa_auto?: boolean | null;
    locale?: string | null;
    fee_overdue_dedupe_days?: number | null;
  } | null,
): MessagingSettings {
  return normalizeMessagingSettings({
    waAuto: row?.wa_auto === true,
    locale: row?.locale === "ml" ? "ml" : DEFAULT_MESSAGING_SETTINGS.locale,
    feeOverdueDedupeDays: normalizeFeeOverdueDedupeDays(
      row?.fee_overdue_dedupe_days,
    ),
  });
}

/** Queueing overdue reminders is a fees write. fees:read is not enough. */
export function canQueueFeeOverdue(
  fees: "none" | "read" | "write" | boolean | undefined,
): boolean {
  return fees === true || fees === "write";
}

/** Assisted send is messages:write. fees:read alone is not enough. */
export function canSendFeeOverdue(
  messages: "none" | "read" | "write" | boolean | undefined,
): boolean {
  return messages === true || messages === "write";
}

export type FeeBalanceStudent = {
  id: string;
  fullName: string;
  feeTotal: number;
  paidTotal: number;
  feeDueDate: string | null;
  status?: string | null;
  guardianPhone?: string | null;
  studentPhone?: string | null;
};

export type OverdueFeeStudent = {
  id: string;
  fullName: string;
  balance: number;
  feeDueDate: string;
  paidTotal: number;
  feeTotal: number;
  phone: ResolvedParentPhone | null;
};

export function isStudentFeeOverdue(input: {
  balance: number;
  feeDueDate: string | null | undefined;
  today?: string;
}): boolean {
  if (!(input.balance > 0)) return false;
  const due = input.feeDueDate?.slice(0, 10);
  if (!due) return false;
  const today = input.today ?? todayISO();
  return due < today;
}

/**
 * Students with balance > 0 and a due date already passed (IST).
 * Zero-balance and not-yet-due rows never appear. Sorted by amount desc.
 */
export function listOverdueFeeStudents(
  students: FeeBalanceStudent[],
  today: string = todayISO(),
): OverdueFeeStudent[] {
  return students
    .filter((student) => student.status !== "archived")
    .map((student) => {
      const balance = remainingFeeBalance(student.feeTotal, student.paidTotal);
      return {
        id: student.id,
        fullName: student.fullName,
        balance,
        feeDueDate: student.feeDueDate?.slice(0, 10) ?? "",
        paidTotal: student.paidTotal,
        feeTotal: student.feeTotal,
        phone: resolveParentWhatsAppPhone({
          guardian_phone: student.guardianPhone,
          phone: student.studentPhone,
        }),
      };
    })
    .filter((student) =>
      isStudentFeeOverdue({
        balance: student.balance,
        feeDueDate: student.feeDueDate,
        today,
      }),
    )
    .sort((a, b) => {
      if (b.balance !== a.balance) return b.balance - a.balance;
      return a.fullName.localeCompare(b.fullName);
    });
}

export function reminderDayISO(
  row: Pick<MessageOutboxRow, "status" | "sent_at" | "created_at">,
): string {
  const ts =
    row.status === "sent" && row.sent_at ? row.sent_at : row.created_at;
  return todayISO(new Date(ts));
}

/** True when a prior queued/sent reminder still sits inside the N-day window. */
export function inFeeOverdueDedupeWindow(
  lastDayISO: string,
  today: string,
  days: number,
): boolean {
  const window = normalizeFeeOverdueDedupeDays(days);
  return lastDayISO.slice(0, 10) > addCalendarDaysISO(today, -window);
}

export type ExistingFeeOverdueRow = Pick<
  MessageOutboxRow,
  | "student_id"
  | "dedupe_key"
  | "status"
  | "created_at"
  | "sent_at"
  | "skip_reason"
>;

export function lastRemindedByStudent(
  rows: ExistingFeeOverdueRow[],
): Map<string, { at: string; status: OutboxStatus; dayISO: string }> {
  const latest = new Map<
    string,
    { at: string; status: OutboxStatus; dayISO: string }
  >();
  for (const row of rows) {
    if (!row.student_id) continue;
    if (row.status !== "queued" && row.status !== "sent") continue;
    const at =
      row.status === "sent" && row.sent_at ? row.sent_at : row.created_at;
    const prev = latest.get(row.student_id);
    if (!prev || at > prev.at) {
      latest.set(row.student_id, {
        at,
        status: row.status,
        dayISO: reminderDayISO(row),
      });
    }
  }
  return latest;
}

export type PlannedFeeOverdueRow = {
  studentId: string;
  kind: "fee_overdue";
  phone: string | null;
  body: string | null;
  status: "queued" | "skipped";
  skipReason: SkipReason | null;
  dedupeKey: string;
  payload: FeeOverduePayload;
};

export type FeeOverduePlan = {
  inserts: PlannedFeeOverdueRow[];
  already: number;
  ignoredNotOverdue: number;
};

/**
 * Staff "Remind overdue" → one fee_overdue row per student per day,
 * blocked if a queued/sent row already exists inside the dedupe window.
 * Zero-balance and not-yet-due students are dropped before insert.
 */
export function planFeeOverdueOutbox(input: {
  students: FeeBalanceStudent[];
  requestedIds?: string[] | null;
  existing: ExistingFeeOverdueRow[];
  centreName: string;
  locale?: string;
  today?: string;
  dedupeDays?: number;
}): FeeOverduePlan {
  const today = input.today ?? todayISO();
  const days = normalizeFeeOverdueDedupeDays(input.dedupeDays);
  const overdue = listOverdueFeeStudents(input.students, today);
  const requested = input.requestedIds?.length
    ? new Set(input.requestedIds)
    : null;
  const targets = requested
    ? overdue.filter((student) => requested.has(student.id))
    : overdue;
  const ignoredNotOverdue = requested
    ? [...requested].filter((id) => !targets.some((s) => s.id === id)).length
    : 0;

  const lastByStudent = lastRemindedByStudent(input.existing);
  const existingToday = new Set(
    input.existing
      .filter((row) => row.dedupe_key.endsWith(`:${today}`))
      .map((row) => row.dedupe_key),
  );

  const inserts: PlannedFeeOverdueRow[] = [];
  let already = 0;

  for (const student of targets) {
    const last = lastByStudent.get(student.id);
    if (last && inFeeOverdueDedupeWindow(last.dayISO, today, days)) {
      already += 1;
      continue;
    }
    const key = feeOverdueDedupeKey(student.id, today);
    if (existingToday.has(key)) {
      already += 1;
      continue;
    }

    const rendered = renderFeeOverdueTemplate(
      {
        studentName: student.fullName,
        balance: student.balance,
        dueDate: student.feeDueDate,
        centreName: input.centreName,
      },
      input.locale,
    );
    const payload: FeeOverduePayload = {
      studentName: student.fullName,
      balance: student.balance,
      dueDate: student.feeDueDate,
      centreName: input.centreName,
      phoneSource: student.phone?.source ?? null,
    };

    if (!student.phone) {
      inserts.push({
        studentId: student.id,
        kind: "fee_overdue",
        phone: null,
        body: rendered.body,
        status: "skipped",
        skipReason: "no_phone",
        dedupeKey: key,
        payload,
      });
      continue;
    }

    inserts.push({
      studentId: student.id,
      kind: "fee_overdue",
      phone: student.phone.e164,
      body: rendered.body,
      status: "queued",
      skipReason: null,
      dedupeKey: key,
      payload,
    });
  }

  return { inserts, already, ignoredNotOverdue };
}
