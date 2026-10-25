import type {
  AbsencePayload,
  FeePaidPayload,
  MessagingSettings,
  MessageOutboxRow,
  OutboxStatus,
  ResolvedParentPhone,
  SkipReason,
} from "./types";
import { DEFAULT_MESSAGING_SETTINGS } from "./types";
import { renderAbsenceTemplate, renderFeePaidTemplate } from "./templates";
import { publicReceiptUrl } from "@/lib/share-links";
import { SITE_URL } from "@/lib/site";

/** Absence uniqueness: one row per student per attendance session. */
export function absenceDedupeKey(sessionId: string, studentId: string): string {
  return `absence:${sessionId}:${studentId}`;
}

/** Fee-paid uniqueness: one ack row per payment. Webhook replay is a no-op. */
export function feePaidDedupeKey(paymentId: string): string {
  return `fee_paid:${paymentId}`;
}

export function normalizeMessagingSettings(
  raw: Partial<MessagingSettings> | null | undefined,
): MessagingSettings {
  return {
    waAuto: raw?.waAuto === true,
    locale: raw?.locale === "ml" ? "ml" : "en",
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
  } | null,
): MessagingSettings {
  return normalizeMessagingSettings({
    waAuto: row?.wa_auto === true,
    locale: row?.locale === "ml" ? "ml" : DEFAULT_MESSAGING_SETTINGS.locale,
  });
}
