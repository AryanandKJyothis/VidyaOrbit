import { addCalendarDaysISO, istMonthStartISO } from "@/lib/format";

export type AttendanceMark = {
  student_id?: string;
  status: string;
  session_date: string;
};

export type MonthFeePayment = {
  student_id: string;
  amount: number;
  payment_date: string;
};

export type MonthlyAttendanceSummary = {
  daysPresent: number;
  daysAbsent: number;
  marked: number;
  percent: number;
};

export type MonthlyFeeSummary = {
  status: "paid" | "due";
  paidAmount: number;
  dueAmount: number;
  monthlyFee: number;
};

/** First IST calendar day of `month` (`YYYY-MM` or `YYYY-MM-DD`). */
export function reportMonthStart(month: string): string {
  const raw = month.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(raw)) return istMonthStartISO();
  return `${raw}-01`;
}

export function reportMonthEnd(month: string): string {
  const start = reportMonthStart(month);
  const next = addCalendarDaysISO(`${start.slice(0, 7)}-28`, 10);
  return addCalendarDaysISO(`${next.slice(0, 7)}-01`, -1);
}

export function reportMonthLabel(month: string): string {
  const start = reportMonthStart(month);
  const date = new Date(`${start}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return month;
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function listRecentReportMonths(
  count = 12,
  now: Date = new Date(),
): { value: string; label: string }[] {
  const start = istMonthStartISO(now);
  const months: { value: string; label: string }[] = [];
  let cursor = start;
  for (let i = 0; i < count; i += 1) {
    months.push({ value: cursor, label: reportMonthLabel(cursor) });
    cursor = addCalendarDaysISO(cursor, -1);
    cursor = `${cursor.slice(0, 7)}-01`;
  }
  return months;
}

export function inReportMonth(isoDate: string, month: string): boolean {
  const day = isoDate.slice(0, 10);
  return day >= reportMonthStart(month) && day <= reportMonthEnd(month);
}

export function summarizeMonthlyAttendance(
  records: AttendanceMark[],
  month: string,
  studentId?: string,
): MonthlyAttendanceSummary {
  let daysPresent = 0;
  let daysAbsent = 0;
  for (const row of records) {
    if (studentId && row.student_id && row.student_id !== studentId) continue;
    if (!inReportMonth(row.session_date, month)) continue;
    if (row.status === "present" || row.status === "late") daysPresent += 1;
    else if (row.status === "absent") daysAbsent += 1;
  }
  const marked = daysPresent + daysAbsent;
  return {
    daysPresent,
    daysAbsent,
    marked,
    percent: marked === 0 ? 0 : Math.round((daysPresent / marked) * 100),
  };
}

/**
 * Treat `feeTotal` as the month's fee (product language). Paid = payments
 * dated in that month. Due = leftover against that month's fee.
 */
export function summarizeMonthlyFee(
  payments: MonthFeePayment[],
  month: string,
  feeTotal: number,
  studentId?: string,
): MonthlyFeeSummary {
  const monthlyFee = Number.isFinite(feeTotal) ? Math.max(0, feeTotal) : 0;
  let paidAmount = 0;
  for (const pay of payments) {
    if (studentId && pay.student_id !== studentId) continue;
    if (!inReportMonth(pay.payment_date, month)) continue;
    paidAmount += Number(pay.amount) || 0;
  }
  const dueAmount = Math.max(0, monthlyFee - paidAmount);
  return {
    status: dueAmount <= 0 ? "paid" : "due",
    paidAmount,
    dueAmount,
    monthlyFee,
  };
}

export function canSendReportCard(
  students: "none" | "read" | "write" | boolean | undefined,
  attendance: "none" | "read" | "write" | boolean | undefined,
): boolean {
  const seesStudent =
    students === true || students === "read" || students === "write";
  const canMark = attendance === true || attendance === "write";
  return seesStudent && canMark;
}

export function canViewReportCard(
  students: "none" | "read" | "write" | boolean | undefined,
  attendance: "none" | "read" | "write" | boolean | undefined,
): boolean {
  const seesStudent =
    students === true || students === "read" || students === "write";
  const seesAttendance =
    attendance === true || attendance === "read" || attendance === "write";
  return seesStudent && seesAttendance;
}
