import { GraduationCap } from "lucide-react";
import { formatINR } from "@/lib/format";
import type { PublicReport } from "@/lib/share-links";

export function ReportCardDocument({ report }: { report: PublicReport }) {
  const feePaid = report.fee_status === "paid";
  return (
    <div className="print-card rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-10">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold leading-tight">
              {report.centre_name || "Centre"}
            </h1>
            <p className="text-xs text-muted-foreground">Monthly report card</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {report.month}
          </div>
          {report.batch_name && (
            <div className="mt-1 text-sm font-medium">{report.batch_name}</div>
          )}
        </div>
      </div>

      <div className="py-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Student
        </p>
        <p className="font-display text-2xl font-semibold">
          {report.student_name}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Attendance"
          value={`${report.attendance_percent}%`}
          hint={`${report.days_present} present · ${report.days_absent} absent`}
        />
        <Stat
          label="Fee"
          value={feePaid ? "Paid" : "Due"}
          hint={
            feePaid
              ? formatINR(report.fee_paid_amount)
              : `${formatINR(report.fee_due_amount)} due`
          }
          tone={feePaid ? "ok" : "warn"}
        />
        <Stat
          label="Paid this month"
          value={formatINR(report.fee_paid_amount)}
        />
      </div>

      {report.teacher_remark && (
        <div className="mt-6 rounded-xl bg-muted/50 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Teacher remark
          </p>
          <p className="mt-1 text-sm leading-relaxed">
            {report.teacher_remark}
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-xl bg-primary-soft/60 p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={
          tone === "warn"
            ? "mt-1 font-display text-2xl font-semibold text-signal"
            : "mt-1 font-display text-2xl font-semibold text-primary"
        }
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
