import { SITE_URL } from "@/lib/site";
import { formatINR } from "@/lib/format";
import { whatsAppDigits } from "@/lib/fee-reminder";

export const PUBLIC_RECEIPT_PATH = "/r";
export const PUBLIC_REPORT_PATH = "/report";

/** Fields a public receipt RPC may return. Used to lock the allowlist in tests. */
export const PUBLIC_RECEIPT_KEYS = [
  "ok",
  "centre_name",
  "receipt_number",
  "student_name",
  "amount",
  "payment_date",
  "period",
  "payment_mode",
  "status",
] as const;

export const PUBLIC_REPORT_KEYS = [
  "ok",
  "centre_name",
  "student_name",
  "batch_name",
  "month",
  "report_month",
  "attendance_percent",
  "days_present",
  "days_absent",
  "fee_status",
  "fee_paid_amount",
  "fee_due_amount",
  "teacher_remark",
] as const;

export const PUBLIC_SHARE_FORBIDDEN_KEYS = [
  "phone",
  "guardian_phone",
  "contact_phone",
  "student_phone",
  "email",
  "contact_email",
  "owner_id",
  "student_id",
  "payment_id",
  "address",
] as const;

export function publicReceiptPath(token: string): string {
  return `${PUBLIC_RECEIPT_PATH}/${token}`;
}

export function publicReportPath(token: string): string {
  return `${PUBLIC_REPORT_PATH}/${token}`;
}

export function publicShareOrigin(origin?: string | null): string {
  const raw = (origin ?? SITE_URL).trim().replace(/\/$/, "");
  return raw || SITE_URL;
}

export function publicReceiptUrl(
  token: string,
  origin?: string | null,
): string {
  return `${publicShareOrigin(origin)}${publicReceiptPath(token)}`;
}

export function publicReportUrl(token: string, origin?: string | null): string {
  return `${publicShareOrigin(origin)}${publicReportPath(token)}`;
}

export function isShareTokenShape(token: string | null | undefined): boolean {
  if (!token) return false;
  return /^[A-Za-z0-9_-]{20,200}$/.test(token);
}

export type PublicReceipt = {
  ok: true;
  centre_name: string;
  receipt_number: string | null;
  student_name: string;
  amount: number;
  payment_date: string;
  period: string;
  payment_mode: string;
  status: "Paid";
};

export type PublicReport = {
  ok: true;
  centre_name: string;
  student_name: string;
  batch_name: string | null;
  month: string;
  report_month: string;
  attendance_percent: number;
  days_present: number;
  days_absent: number;
  fee_status: "paid" | "due";
  fee_paid_amount: number;
  fee_due_amount: number;
  teacher_remark: string | null;
};

export type PublicShareMiss = {
  ok: false;
  reason: "not_found" | "revoked" | "unavailable";
};

function parsePublicShareMiss(row: Record<string, unknown>): PublicShareMiss {
  if (row.reason === "revoked") {
    return { ok: false, reason: "revoked" };
  }
  if (row.reason === "unavailable" || row.reason === "rate_limited") {
    return { ok: false, reason: "unavailable" };
  }
  return { ok: false, reason: "not_found" };
}

export function parsePublicReceipt(
  raw: unknown,
): PublicReceipt | PublicShareMiss {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "not_found" };
  }
  const row = raw as Record<string, unknown>;
  if (row.ok !== true) {
    return parsePublicShareMiss(row);
  }
  return {
    ok: true,
    centre_name: String(row.centre_name ?? ""),
    receipt_number:
      row.receipt_number == null ? null : String(row.receipt_number),
    student_name: String(row.student_name ?? ""),
    amount: Number(row.amount ?? 0),
    payment_date: String(row.payment_date ?? ""),
    period: String(row.period ?? ""),
    payment_mode: String(row.payment_mode ?? ""),
    status: "Paid",
  };
}

export function parsePublicReport(
  raw: unknown,
): PublicReport | PublicShareMiss {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "not_found" };
  }
  const row = raw as Record<string, unknown>;
  if (row.ok !== true) {
    return parsePublicShareMiss(row);
  }
  return {
    ok: true,
    centre_name: String(row.centre_name ?? ""),
    student_name: String(row.student_name ?? ""),
    batch_name: row.batch_name == null ? null : String(row.batch_name),
    month: String(row.month ?? ""),
    report_month: String(row.report_month ?? ""),
    attendance_percent: Number(row.attendance_percent ?? 0),
    days_present: Number(row.days_present ?? 0),
    days_absent: Number(row.days_absent ?? 0),
    fee_status: row.fee_status === "due" ? "due" : "paid",
    fee_paid_amount: Number(row.fee_paid_amount ?? 0),
    fee_due_amount: Number(row.fee_due_amount ?? 0),
    teacher_remark:
      row.teacher_remark == null ? null : String(row.teacher_remark),
  };
}

export function buildReportShareMessage(input: {
  centreName: string;
  studentName: string;
  month: string;
  attendancePercent: number;
  daysPresent: number;
  daysAbsent: number;
  feeStatus: "paid" | "due";
  feePaidAmount: number;
  feeDueAmount: number;
  reportUrl?: string | null;
  guardianPhone?: string | null;
  studentPhone?: string | null;
}): { message: string; href: string | null } {
  const centre = input.centreName.trim() || "your centre";
  const feeLine =
    input.feeStatus === "paid"
      ? `Fee: Paid ${formatINR(input.feePaidAmount)}`
      : `Fee: Due ${formatINR(input.feeDueAmount)}`;
  const message = [
    `${input.studentName}'s report card — ${input.month}`,
    `From ${centre}`,
    `Attendance: ${input.attendancePercent}% (${input.daysPresent} present, ${input.daysAbsent} absent)`,
    feeLine,
    input.reportUrl ? `Open report: ${input.reportUrl}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
  const digits =
    whatsAppDigits(input.guardianPhone) ?? whatsAppDigits(input.studentPhone);
  return {
    message,
    href: digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
      : null,
  };
}
