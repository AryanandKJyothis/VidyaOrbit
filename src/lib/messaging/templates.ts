import { formatDate } from "@/lib/format";
import { publicReceiptUrl } from "@/lib/share-links";
import { SITE_URL } from "@/lib/site";
import type { MessageLocale } from "./types";

export const ABSENCE_TEMPLATE_KEY = "absence.v1";

export type AbsenceTemplateInput = {
  studentName: string;
  centreName: string;
  sessionDate: string;
  batchName: string;
};

type TemplateFn = (input: AbsenceTemplateInput) => string;

function formatSessionDate(iso: string): string {
  const day = iso.slice(0, 10);
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return formatDate(new Date(Date.UTC(year, month - 1, date, 12, 0, 0)));
}

const enAbsence: TemplateFn = ({
  studentName,
  centreName,
  sessionDate,
  batchName,
}) => {
  const name = studentName.trim() || "your child";
  const centre = centreName.trim() || "the centre";
  const batch = batchName.trim() || "class";
  const date = formatSessionDate(sessionDate);
  return `Dear parent, ${name} was absent today (${date}, ${batch}) at ${centre}. Please contact us if this is unexpected.`;
};

/**
 * Phase B hook. Malayalam renderer stays null until that work lands.
 * `renderAbsenceTemplate("ml")` falls back to English.
 */
export const ABSENCE_TEMPLATES: Record<MessageLocale, TemplateFn | null> = {
  en: enAbsence,
  ml: null,
};

export function resolveMessageLocale(
  raw: string | null | undefined,
): MessageLocale {
  return raw === "ml" ? "ml" : "en";
}

export function renderAbsenceTemplate(
  input: AbsenceTemplateInput,
  locale: string | null | undefined = "en",
): { body: string; locale: MessageLocale; templateKey: string } {
  const requested = resolveMessageLocale(locale);
  const used: MessageLocale = ABSENCE_TEMPLATES[requested] ? requested : "en";
  const renderer = ABSENCE_TEMPLATES[used] ?? enAbsence;
  return {
    body: renderer(input),
    locale: used,
    templateKey: ABSENCE_TEMPLATE_KEY,
  };
}

export const FEE_PAID_TEMPLATE_KEY = "fee_paid.v1";

export type FeePaidTemplateInput = {
  studentName: string;
  amount: number;
  paymentDate: string;
  receiptNumber: string | null;
  shareToken: string;
  balance: number;
};

/**
 * Indian grouping, no decimals, no locale-dependent spaces.
 * Must match public.format_inr_ack in the A3 migration.
 */
export function formatAckRupees(amount: number): string {
  const n = Math.round(Number.isFinite(amount) ? amount : 0);
  const digits = String(Math.abs(n));
  if (digits.length <= 3) {
    return `₹${n < 0 ? "-" : ""}${digits}`;
  }
  let grouped = digits.slice(-3);
  let rest = digits.slice(0, -3);
  while (rest.length > 0) {
    const chunk = rest.slice(-2);
    grouped = `${chunk},${grouped}`;
    rest = rest.slice(0, -chunk.length);
  }
  return `₹${n < 0 ? "-" : ""}${grouped}`;
}

export function formatAckDate(iso: string): string {
  const day = iso.slice(0, 10);
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return formatDate(new Date(Date.UTC(year, month - 1, date, 12, 0, 0)));
}

const enFeePaid = (input: FeePaidTemplateInput): string => {
  const name = input.studentName.trim() || "your child";
  const receipt = input.receiptNumber?.trim() || "—";
  const url = publicReceiptUrl(input.shareToken, SITE_URL);
  return `Payment received: ${formatAckRupees(input.amount)} for ${name} on ${formatAckDate(input.paymentDate)}. Receipt ${receipt}: ${url}. Balance: ${formatAckRupees(input.balance)}.`;
};

/**
 * Phase B hook. Malayalam renderer stays null until that work lands.
 * `renderFeePaidTemplate("ml")` falls back to English.
 */
export const FEE_PAID_TEMPLATES: Record<
  MessageLocale,
  ((input: FeePaidTemplateInput) => string) | null
> = {
  en: enFeePaid,
  ml: null,
};

export function renderFeePaidTemplate(
  input: FeePaidTemplateInput,
  locale: string | null | undefined = "en",
): { body: string; locale: MessageLocale; templateKey: string } {
  const requested = resolveMessageLocale(locale);
  const used: MessageLocale = FEE_PAID_TEMPLATES[requested] ? requested : "en";
  const renderer = FEE_PAID_TEMPLATES[used] ?? enFeePaid;
  return {
    body: renderer(input),
    locale: used,
    templateKey: FEE_PAID_TEMPLATE_KEY,
  };
}

export const FEE_OVERDUE_TEMPLATE_KEY = "fee_overdue.v1";

export type FeeOverdueTemplateInput = {
  studentName: string;
  balance: number;
  dueDate: string;
  centreName: string;
};

const enFeeOverdue = (input: FeeOverdueTemplateInput): string => {
  const name = input.studentName.trim() || "your child";
  const centre = input.centreName.trim() || "the centre";
  return `Dear parent, ${name} has an overdue balance of ${formatAckRupees(input.balance)} at ${centre}. Due date: ${formatAckDate(input.dueDate)}. Please contact us to pay.`;
};

/**
 * Phase B hook. Malayalam renderer stays null until that work lands.
 * `renderFeeOverdueTemplate("ml")` falls back to English. No UPI link.
 */
export const FEE_OVERDUE_TEMPLATES: Record<
  MessageLocale,
  ((input: FeeOverdueTemplateInput) => string) | null
> = {
  en: enFeeOverdue,
  ml: null,
};

export function renderFeeOverdueTemplate(
  input: FeeOverdueTemplateInput,
  locale: string | null | undefined = "en",
): { body: string; locale: MessageLocale; templateKey: string } {
  const requested = resolveMessageLocale(locale);
  const used: MessageLocale = FEE_OVERDUE_TEMPLATES[requested]
    ? requested
    : "en";
  const renderer = FEE_OVERDUE_TEMPLATES[used] ?? enFeeOverdue;
  return {
    body: renderer(input),
    locale: used,
    templateKey: FEE_OVERDUE_TEMPLATE_KEY,
  };
}
