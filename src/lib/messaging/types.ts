/** Reusable parent-messaging kinds. A1 sends `absence` only. */
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

export type MessagingSettings = {
  /** Tier 2 auto-send. Off until the centre has a verified number + templates. */
  waAuto: boolean;
  /** English MVP. `ml` is reserved for Phase B. */
  locale: MessageLocale;
};

export const DEFAULT_MESSAGING_SETTINGS: MessagingSettings = {
  waAuto: false,
  locale: "en",
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
