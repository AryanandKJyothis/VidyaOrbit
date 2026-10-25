/** Reusable parent-messaging kinds. A1 absence, A2 fee_overdue, A3 fee_paid. */
export const MESSAGE_KINDS = ["absence", "fee_overdue", "fee_paid"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const MESSAGE_LOCALES = ["en", "ml"] as const;
export type MessageLocale = (typeof MESSAGE_LOCALES)[number];

/** Shared outbox statuses for A1–A3. */
export const OUTBOX_STATUSES = ["queued", "sent", "failed", "skipped"] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export const SKIP_REASONS = ["not_absent", "no_phone"] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export const SENT_VIA = ["wa_me", "worker"] as const;
export type SentVia = (typeof SENT_VIA)[number];

export const DEFAULT_FEE_OVERDUE_DEDUPE_DAYS = 3;
export const MIN_FEE_OVERDUE_DEDUPE_DAYS = 1;
export const MAX_FEE_OVERDUE_DEDUPE_DAYS = 30;

export type MessagingSettings = {
  /** Tier 2 auto-send. Off until the centre has a verified number + templates. */
  waAuto: boolean;
  /** English MVP. `ml` is reserved for Phase B. */
  locale: MessageLocale;
  /** One fee_overdue row per student inside this many IST days. */
  feeOverdueDedupeDays: number;
};

export const DEFAULT_MESSAGING_SETTINGS: MessagingSettings = {
  waAuto: false,
  locale: "en",
  feeOverdueDedupeDays: DEFAULT_FEE_OVERDUE_DEDUPE_DAYS,
};

export type ResolvedParentPhone = {
  /** Stored as +91XXXXXXXXXX */
  e164: string;
  /** Digits for wa.me (91XXXXXXXXXX) */
  waMe: string;
  source: "guardian" | "student";
};

export type MessageOutboxRow = {
  id: string;
  owner_id: string;
  student_id: string | null;
  session_id: string | null;
  session_date: string | null;
  kind: MessageKind;
  phone: string | null;
  body: string | null;
  status: OutboxStatus;
  skip_reason: SkipReason | string | null;
  dedupe_key: string;
  created_by: string | null;
  sent_at: string | null;
  sent_via: SentVia | string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type AbsencePayload = {
  studentName: string;
  batchName: string;
  sessionDate: string;
  centreName: string;
  phoneSource: ResolvedParentPhone["source"] | null;
};

export type FeePaidPayload = {
  paymentId: string;
  studentName: string;
  amount: number;
  paymentDate: string;
  receiptNumber: string | null;
  receiptUrl: string;
  shareToken: string;
  balance: number;
  phoneSource: ResolvedParentPhone["source"] | null;
};

export type FeeOverduePayload = {
  studentName: string;
  balance: number;
  dueDate: string;
  centreName: string;
  phoneSource: ResolvedParentPhone["source"] | null;
};

export type AbsenceQueueSummary = {
  queued: number;
  sent: number;
  skippedNoPhone: number;
  skippedNotAbsent: number;
  failed: number;
  already: number;
};

export const EMPTY_ABSENCE_QUEUE_SUMMARY: AbsenceQueueSummary = {
  queued: 0,
  sent: 0,
  skippedNoPhone: 0,
  skippedNotAbsent: 0,
  failed: 0,
  already: 0,
};

export type FeePaidQueueSummary = AbsenceQueueSummary;
export const EMPTY_FEE_PAID_QUEUE_SUMMARY: FeePaidQueueSummary = {
  ...EMPTY_ABSENCE_QUEUE_SUMMARY,
};

export type FeeOverdueQueueSummary = AbsenceQueueSummary;
export const EMPTY_FEE_OVERDUE_QUEUE_SUMMARY: FeeOverdueQueueSummary = {
  ...EMPTY_ABSENCE_QUEUE_SUMMARY,
};
