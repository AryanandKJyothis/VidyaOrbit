import { useState, type ReactNode } from "react";
import {
  AlertCircle,
  CalendarCheck,
  Check,
  Clock,
  Layers,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/format";
import {
  SAMPLE_ATTENDANCE,
  SAMPLE_BATCHES,
  SAMPLE_CENTRE,
  SAMPLE_DASHBOARD,
  SAMPLE_FEES,
  SAMPLE_LABEL,
  sampleBalance,
  type SampleAttStatus,
} from "@/lib/landing-sample";

type Tab = "dashboard" | "fees" | "attendance";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "fees", label: "Fees & dues" },
  { id: "attendance", label: "Attendance" },
];

export function ProductPreviews() {
  const [tab, setTab] = useState<Tab>("fees");

  return (
    <div className="rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-lift)] sm:p-3">
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-coral)]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-saffron)]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-teal)]/70" />
          <span className="ml-2 truncate text-[11px] font-medium text-muted-foreground">
            {SAMPLE_CENTRE}
          </span>
          <span className="ml-auto rounded bg-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
            {SAMPLE_LABEL}
          </span>
        </div>
        <div className="flex gap-1 border-b border-border p-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "min-h-10 flex-1 rounded-lg px-2 text-xs font-semibold sm:text-sm",
                tab === t.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-3 sm:p-4">
          {tab === "dashboard" && <DashboardPreview />}
          {tab === "fees" && <FeesPreview />}
          {tab === "attendance" && <AttendancePreview />}
        </div>
      </div>
    </div>
  );
}

function PreviewStat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-[color:var(--brand-teal)]" />
      </div>
      <p className="mt-1 font-display text-xl font-bold tabular-nums sm:text-2xl">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function DashboardPreview() {
  const overdue = SAMPLE_FEES.filter((r) => r.status === "overdue");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <PreviewStat
          label="Students"
          value={String(SAMPLE_DASHBOARD.students)}
          hint="Active"
          icon={Users}
        />
        <PreviewStat
          label="Batches"
          value={String(SAMPLE_DASHBOARD.batches)}
          hint={`${SAMPLE_BATCHES.length} running`}
          icon={Layers}
        />
        <PreviewStat
          label="Dues"
          value={formatINR(SAMPLE_DASHBOARD.dues)}
          hint={`${SAMPLE_DASHBOARD.overdueCount} overdue`}
          icon={AlertCircle}
        />
        <PreviewStat
          label="Attendance"
          value={`${SAMPLE_DASHBOARD.attendancePct}%`}
          hint="Last 30 days"
          icon={CalendarCheck}
        />
      </div>
      <Card className="hover:shadow-none">
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="text-sm sm:text-base">Overdue dues</CardTitle>
          <p className="text-xs text-muted-foreground">
            {overdue.length} students ·{" "}
            {formatINR(overdue.reduce((s, r) => s + (r.total - r.paid), 0))}
          </p>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0 sm:p-4 sm:pt-0">
          {overdue.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Due {row.due}
                </p>
              </div>
              <Badge variant="destructive" className="font-mono text-[11px]">
                {sampleBalance(row)}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function FeesPreview() {
  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <PreviewStat
          label="Collected"
          value={formatINR(SAMPLE_DASHBOARD.collectedMonth)}
          hint="This month"
          icon={Wallet}
        />
        <PreviewStat
          label="Pending"
          value={formatINR(
            SAMPLE_FEES.filter((r) => r.status === "pending").reduce(
              (s, r) => s + (r.total - r.paid),
              0,
            ),
          )}
          hint="Not yet due"
          icon={Clock}
        />
        <PreviewStat
          label="Overdue"
          value={formatINR(
            SAMPLE_FEES.filter((r) => r.status === "overdue").reduce(
              (s, r) => s + (r.total - r.paid),
              0,
            ),
          )}
          hint="Follow up today"
          icon={AlertCircle}
        />
        <PreviewStat
          label="Paid up"
          value={String(SAMPLE_FEES.filter((r) => r.status === "paid").length)}
          hint="This list"
          icon={Check}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[28rem] text-sm">
          <thead className="bg-muted/40 text-left text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Batch</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {SAMPLE_FEES.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.batch}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {sampleBalance(row)}
                </td>
                <td className="px-3 py-2">
                  {row.status === "paid" ? (
                    <Badge variant="secondary">Paid</Badge>
                  ) : row.status === "overdue" ? (
                    <Badge variant="destructive">Overdue</Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttendancePreview() {
  const [marks, setMarks] = useState<Record<string, SampleAttStatus>>(() =>
    Object.fromEntries(SAMPLE_ATTENDANCE.map((s) => [s.id, s.status])),
  );
  const roster = SAMPLE_ATTENDANCE;
  const summary = {
    present: roster.filter((s) => marks[s.id] === "present").length,
    late: roster.filter((s) => marks[s.id] === "late").length,
    absent: roster.filter((s) => marks[s.id] === "absent").length,
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{SAMPLE_BATCHES[0].name}</p>
          <p className="text-xs text-muted-foreground">
            {SAMPLE_BATCHES[0].timing} · sample roster
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">Present {summary.present}</Badge>
          <Badge variant="outline">Late {summary.late}</Badge>
          <Badge variant="destructive">Absent {summary.absent}</Badge>
        </div>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {roster.map((s) => {
          const v = marks[s.id];
          return (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-[11px] text-muted-foreground">{s.phone}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <MarkBtn
                  active={v === "present"}
                  tone="success"
                  label="Present"
                  onClick={() => setMarks({ ...marks, [s.id]: "present" })}
                >
                  <Check className="h-4 w-4" />
                </MarkBtn>
                <MarkBtn
                  active={v === "late"}
                  tone="warning"
                  label="Late"
                  onClick={() => setMarks({ ...marks, [s.id]: "late" })}
                >
                  <Clock className="h-4 w-4" />
                </MarkBtn>
                <MarkBtn
                  active={v === "absent"}
                  tone="destructive"
                  label="Absent"
                  onClick={() => setMarks({ ...marks, [s.id]: "absent" })}
                >
                  <X className="h-4 w-4" />
                </MarkBtn>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Toggles stay on this page only. Nothing is saved.
      </p>
    </div>
  );
}

function MarkBtn({
  children,
  active,
  tone,
  label,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  tone: "success" | "warning" | "destructive";
  label: string;
  onClick: () => void;
}) {
  const tones = {
    success: "border-success text-success bg-success/10",
    warning: "border-warning text-warning bg-warning/10",
    destructive: "border-destructive text-destructive bg-destructive/10",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-lg border",
        active
          ? tones[tone]
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
