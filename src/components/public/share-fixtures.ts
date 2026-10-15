import type { PublicReceipt, PublicReport } from "@/lib/share-links";

export const FIXTURE_PUBLIC_RECEIPT: PublicReceipt = {
  ok: true,
  centre_name: "Orbit Coaching",
  receipt_number: "RCT-2026-00012",
  student_name: "Amina Rahman",
  amount: 2500,
  payment_date: "2026-10-05",
  period: "October 2026",
  payment_mode: "upi",
  status: "Paid",
};

export const FIXTURE_PUBLIC_REPORT: PublicReport = {
  ok: true,
  centre_name: "Orbit Coaching",
  student_name: "Amina Rahman",
  batch_name: "Class 10 Maths",
  month: "October 2026",
  report_month: "2026-10-01",
  attendance_percent: 86,
  days_present: 18,
  days_absent: 3,
  fee_status: "due",
  fee_paid_amount: 500,
  fee_due_amount: 2000,
  teacher_remark: "Good work in class. Please finish the extra sums.",
};
