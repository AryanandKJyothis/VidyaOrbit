import { formatINR } from "@/lib/format";
import { normalizePhoneKey } from "@/lib/student-import";

/** NPCI transaction notes are short; keep the payee note inside this limit. */
export const UPI_NOTE_MAX = 50;

/** `name@bank` — no spaces. The handle is letters; the user part may include . - _ */
export const UPI_VPA_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export type FeeCollectionStatus = "paid" | "partial" | "overdue" | "pending";

export function isValidUpiVpa(vpa: string | null | undefined): boolean {
  if (!vpa) return false;
  return UPI_VPA_PATTERN.test(vpa.trim());
}

/** Outstanding amount for a UPI intent: no thousands separator. Whole rupees omit decimals. */
export function formatUpiAmount(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  if (cents <= 0) return null;
  const rupees = cents / 100;
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}

/**
 * `upi://pay?pa=…&pn=…&am=…&cu=INR&tn=…`
 * Returns null when the VPA is missing/invalid or the amount is not positive.
 */
export function buildUpiPayUri(input: {
  vpa: string | null | undefined;
  payeeName: string;
  amount: number;
  note: string;
}): string | null {
  const vpa = input.vpa?.trim() ?? "";
  if (!isValidUpiVpa(vpa)) return null;
  const am = formatUpiAmount(input.amount);
  if (!am) return null;
  const pn = truncate(input.payeeName || "Centre", UPI_NOTE_MAX) || "Centre";
  const tn = truncate(input.note || "Fee", UPI_NOTE_MAX) || "Fee";
  const query = [
    ["pa", vpa],
    ["pn", pn],
    ["am", am],
    ["cu", "INR"],
    ["tn", tn],
  ]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return `upi://pay?${query}`;
}

/** Opens one WhatsApp chat. Returns false when the browser blocks the pop-up. */
export function openWhatsApp(href: string): boolean {
  if (typeof window === "undefined") return false;
  return window.open(href, "_blank", "noopener,noreferrer") !== null;
}

/** Last 10 digits, prefixed for wa.me. Shorter numbers are not used. */
export function whatsAppDigits(
  phone: string | null | undefined,
): string | null {
  const key = normalizePhoneKey(phone);
  if (!key || key.length !== 10) return null;
  return `91${key}`;
}

export function feeMonthLabel(feeDueDate: string | null | undefined): string {
  if (!feeDueDate) return "";
  const date = new Date(`${feeDueDate.slice(0, 10)}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function feeCollectionStatus(input: {
  paid: number;
  balance: number;
  overdue: boolean;
}): FeeCollectionStatus {
  if (input.balance <= 0) return "paid";
  if (input.overdue) return "overdue";
  if (input.paid > 0) return "partial";
  return "pending";
}

export function feeStatusLabel(status: FeeCollectionStatus): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "partial":
      return "Partial";
    case "overdue":
      return "Overdue";
    case "pending":
      return "Pending";
  }
}

export type FeeReminderResult =
  | {
      ok: true;
      message: string;
      href: string;
      upiUri: string;
      phoneSource: "guardian" | "student";
    }
  | {
      ok: false;
      reason: "missing_vpa" | "invalid_vpa" | "zero_balance" | "no_phone";
    };

export function buildFeeReminder(input: {
  centreName: string;
  upiVpa: string | null | undefined;
  studentName: string;
  guardianPhone: string | null;
  studentPhone: string | null;
  feeDueDate: string | null;
  balance: number;
}): FeeReminderResult {
  if (!(input.balance > 0)) return { ok: false, reason: "zero_balance" };
  const vpa = input.upiVpa?.trim() ?? "";
  if (!vpa) return { ok: false, reason: "missing_vpa" };
  if (!isValidUpiVpa(vpa)) return { ok: false, reason: "invalid_vpa" };

  const month = feeMonthLabel(input.feeDueDate);
  const upiUri = buildUpiPayUri({
    vpa,
    payeeName: input.centreName,
    amount: input.balance,
    note: `Fee ${input.studentName}`,
  });
  if (!upiUri) return { ok: false, reason: "invalid_vpa" };

  const guardian = whatsAppDigits(input.guardianPhone);
  const student = whatsAppDigits(input.studentPhone);
  const digits = guardian ?? student;
  if (!digits) return { ok: false, reason: "no_phone" };

  const centre = input.centreName.trim() || "your centre";
  const monthLine = month
    ? `${input.studentName} — ${month} fee`
    : `${input.studentName} fee`;
  const message = [
    `Fee reminder from ${centre}`,
    monthLine,
    `Amount due: ${formatINR(input.balance)}`,
    `Pay: ${upiUri}`,
  ].join("\n");

  return {
    ok: true,
    message,
    href: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
    upiUri,
    phoneSource: guardian ? "guardian" : "student",
  };
}

export function reminderSkipReason(
  reason: Extract<FeeReminderResult, { ok: false }>["reason"],
): string {
  switch (reason) {
    case "no_phone":
      return "No guardian or student phone";
    case "zero_balance":
      return "Nothing due";
    case "missing_vpa":
      return "Add a centre UPI ID in Settings";
    case "invalid_vpa":
      return "Centre UPI ID is not valid";
  }
}

/**
 * WhatsApp overdue reminders are a fees write. There is no server send path
 * (client `wa.me` only); UI and this helper must both require write.
 */
export function canSendFeeReminders(
  fees: "none" | "read" | "write" | boolean | undefined,
): boolean {
  return fees === true || fees === "write";
}

/** Receipt share stays a wa.me draft. There is no public receipt URL. */
export function buildReceiptShare(input: {
  centreName: string;
  studentName: string;
  guardianPhone: string | null;
  studentPhone: string | null;
  amount: number;
  receiptNumber: string | null;
}): { message: string; href: string | null } {
  const centre = input.centreName.trim() || "your centre";
  const number = input.receiptNumber?.trim();
  const message = [
    number ? `Receipt ${number} from ${centre}` : `Receipt from ${centre}`,
    `${input.studentName} paid ${formatINR(input.amount)}.`,
  ].join("\n");
  const digits =
    whatsAppDigits(input.guardianPhone) ?? whatsAppDigits(input.studentPhone);
  return {
    message,
    href: digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
      : null,
  };
}
