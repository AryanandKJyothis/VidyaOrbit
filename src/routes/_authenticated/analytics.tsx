import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  differenceInDays,
  parseISO,
} from "date-fns";
import {
  Wallet,
  AlertTriangle,
  UserPlus,
  CalendarCheck,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStudents, useBatches, usePayments } from "@/hooks/use-data";
import { useSubscription, hasMinPlan } from "@/hooks/use-subscription";
import { PlanGate } from "@/components/plan-gate";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useActiveWorkspace, useCan } from "@/hooks/use-active-workspace";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const sub = useSubscription();
  const students = useStudents();
  const batches = useBatches();
  const payments = usePayments();
  const { active } = useActiveWorkspace();
  const canViewFees = useCan("fees", "read");

  const locked = !sub.isLoading && !hasMinPlan(sub.data?.plan, "starter");

  const att = useQuery({
    queryKey: ["att-all", active?.ownerId],
    enabled: !!active?.ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select(
          "status, student_id, attendance_sessions(batch_id, session_date)",
        )
        .eq("owner_id", active!.ownerId);
      if (error) throw error;
      return data as Array<{
        status: string;
        student_id: string;
        attendance_sessions: { batch_id: string; session_date: string } | null;
      }>;
    },
  });

  const now = useMemo(() => new Date(), []);
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  // ---------- Revenue ----------
  const monthly = useMemo(() => {
    const months: { key: string; label: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(now, i));
      months.push({
        key: format(d, "yyyy-MM"),
        label: format(d, "MMM"),
        amount: 0,
      });
    }
    for (const p of payments.data ?? []) {
      const k = p.payment_date.slice(0, 7);
      const m = months.find((x) => x.key === k);
      if (m) m.amount += Number(p.amount);
    }
    return months;
  }, [payments.data, now]);

  const thisMonthRevenue = monthly[monthly.length - 1]?.amount ?? 0;
  const lastMonthRevenue = monthly[monthly.length - 2]?.amount ?? 0;
  const revenueDelta =
    lastMonthRevenue > 0
      ? Math.round(
          ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100,
        )
      : thisMonthRevenue > 0
        ? 100
        : 0;

  const collectedYtd = useMemo(() => {
    return payments.data?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  }, [payments.data]);

  const totalPaymentsYtd = payments.data?.length ?? 0;

  // ---------- Outstanding dues ----------
  const dues = useMemo(() => {
    const paidByStudent: Record<string, number> = {};
    for (const p of payments.data ?? []) {
      paidByStudent[p.student_id] =
        (paidByStudent[p.student_id] ?? 0) + Number(p.amount);
    }
    const overdue: Array<{
      id: string;
      name: string;
      due: number;
      daysOverdue: number;
      dueDate: string | null;
    }> = [];
    let totalDue = 0;
    for (const s of students.data ?? []) {
      if (s.status === "archived") continue;
      const paid = paidByStudent[s.id] ?? 0;
      const due = Number(s.fee_total ?? 0) - paid;
      if (due <= 0) continue;
      totalDue += due;
      const daysOver = s.fee_due_date
        ? differenceInDays(now, parseISO(s.fee_due_date))
        : 0;
      overdue.push({
        id: s.id,
        name: s.full_name,
        due,
        daysOverdue: daysOver,
        dueDate: s.fee_due_date,
      });
    }
    overdue.sort((a, b) => b.due - a.due);
    return { totalDue, list: overdue };
  }, [students.data, payments.data, now]);

  // ---------- Students ----------
  const activeStudents = (students.data ?? []).filter(
    (s) => s.status === "active",
  ).length;
  const newThisMonth = (students.data ?? []).filter((s) => {
    const d = parseISO(s.joining_date);
    return isWithinInterval(d, { start: thisMonthStart, end: now });
  }).length;
  const newLastMonth = (students.data ?? []).filter((s) => {
    const d = parseISO(s.joining_date);
    return isWithinInterval(d, { start: lastMonthStart, end: lastMonthEnd });
  }).length;

  // ---------- Attendance ----------
  const attendanceTrend = useMemo(() => {
    const months: {
      key: string;
      label: string;
      rate: number;
      total: number;
      present: number;
    }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(now, i));
      months.push({
        key: format(d, "yyyy-MM"),
        label: format(d, "MMM"),
        rate: 0,
        total: 0,
        present: 0,
      });
    }
    for (const r of att.data ?? []) {
      const date = r.attendance_sessions?.session_date;
      if (!date) continue;
      const k = date.slice(0, 7);
      const m = months.find((x) => x.key === k);
      if (!m) continue;
      m.total++;
      if (r.status === "present" || r.status === "late") m.present++;
    }
    return months.map((m) => ({
      ...m,
      rate: m.total ? Math.round((m.present / m.total) * 100) : 0,
    }));
  }, [att.data, now]);

  const thisMonthAtt = attendanceTrend[attendanceTrend.length - 1];
  const lastMonthAtt = attendanceTrend[attendanceTrend.length - 2];
  const attDelta = (thisMonthAtt?.rate ?? 0) - (lastMonthAtt?.rate ?? 0);

  // ---------- Top batches ----------
  const topBatches = useMemo(() => {
    const map: Record<
      string,
      { name: string; revenue: number; students: number }
    > = {};
    for (const b of batches.data ?? [])
      map[b.id] = { name: b.name, revenue: 0, students: 0 };
    for (const s of students.data ?? []) {
      if (s.batch_id && map[s.batch_id] && s.status === "active")
        map[s.batch_id].students++;
    }
    for (const p of payments.data ?? []) {
      const stu = (students.data ?? []).find((s) => s.id === p.student_id);
      if (stu?.batch_id && map[stu.batch_id])
        map[stu.batch_id].revenue += Number(p.amount);
    }
    return Object.values(map)
      .filter((b) => b.revenue > 0 || b.students > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [batches.data, students.data, payments.data]);

  // ---------- At-risk batches (attendance < 75%) ----------
  const batchAttendance = useMemo(() => {
    const map: Record<
      string,
      { name: string; total: number; present: number }
    > = {};
    for (const b of batches.data ?? [])
      if (b.is_active) map[b.id] = { name: b.name, total: 0, present: 0 };
    for (const r of att.data ?? []) {
      const bid = r.attendance_sessions?.batch_id;
      if (!bid || !map[bid]) continue;
      map[bid].total++;
      if (r.status === "present" || r.status === "late") map[bid].present++;
    }
    return Object.values(map)
      .filter((b) => b.total >= 3)
      .map((b) => ({
        name: b.name,
        rate: Math.round((b.present / b.total) * 100),
      }))
      .sort((a, b) => a.rate - b.rate);
  }, [batches.data, att.data]);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="The numbers that move your institute — revenue, dues, attendance, growth."
      />

      {locked ? (
        <PlanGate min="starter" feature="Analytics">
          {null}
        </PlanGate>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HeroKpi
              label="Revenue this month"
              value={formatINR(thisMonthRevenue)}
              deltaPct={revenueDelta}
              hint={`vs ${formatINR(lastMonthRevenue)} last month`}
              icon={Wallet}
              tone="primary"
              spark={monthly.map((m) => m.amount)}
            />
            <HeroKpi
              label="Collected YTD"
              value={formatINR(collectedYtd)}
              hint={`${totalPaymentsYtd} payment${totalPaymentsYtd === 1 ? "" : "s"} recorded`}
              icon={Wallet}
            />
            {canViewFees && (
              <HeroKpi
                label="Outstanding dues"
                value={formatINR(dues.totalDue)}
                hint={`${dues.list.length} student${dues.list.length === 1 ? "" : "s"} pending`}
                icon={AlertTriangle}
                tone={dues.totalDue > 0 ? "warning" : "success"}
              />
            )}
            <HeroKpi
              label="New admissions"
              value={String(newThisMonth)}
              deltaPct={
                newLastMonth > 0
                  ? Math.round(
                      ((newThisMonth - newLastMonth) / newLastMonth) * 100,
                    )
                  : newThisMonth > 0
                    ? 100
                    : 0
              }
              hint={`${activeStudents} active students`}
              icon={UserPlus}
              tone="success"
            />
            <HeroKpi
              label="Attendance rate"
              value={`${thisMonthAtt?.rate ?? 0}%`}
              deltaPct={attDelta}
              hint={`${thisMonthAtt?.present ?? 0} / ${thisMonthAtt?.total ?? 0} marks this month`}
              icon={CalendarCheck}
              tone={
                (thisMonthAtt?.rate ?? 0) >= 80
                  ? "success"
                  : (thisMonthAtt?.rate ?? 0) >= 60
                    ? "warning"
                    : "danger"
              }
            />
          </div>

          {/* Revenue + Attendance trend */}
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-border/60">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">Revenue trend</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last 6 months collected
                  </p>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <TrendingUp className="size-3" />
                  6M
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer>
                    <AreaChart
                      data={monthly}
                      margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor="oklch(0.55 0.14 250)"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="100%"
                            stopColor="oklch(0.55 0.14 250)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="oklch(0.92 0.01 250)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        stroke="oklch(0.55 0.03 255)"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="oklch(0.55 0.03 255)"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) =>
                          v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                        }
                      />
                      <Tooltip
                        cursor={{
                          stroke: "oklch(0.55 0.14 250)",
                          strokeOpacity: 0.2,
                        }}
                        formatter={(v) => formatINR(Number(v))}
                        contentStyle={{
                          background: "white",
                          border: "1px solid oklch(0.91 0.015 250)",
                          borderRadius: 10,
                          fontSize: 12,
                          boxShadow:
                            "0 8px 24px -12px oklch(0.4 0.1 250 / 0.25)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="oklch(0.55 0.14 250)"
                        strokeWidth={2.5}
                        fill="url(#rev)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Attendance trend</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  % present, last 6 months
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  {(att.data?.length ?? 0) === 0 ? (
                    <EmptyHint text="Mark attendance to see trends" />
                  ) : (
                    <ResponsiveContainer>
                      <LineChart
                        data={attendanceTrend}
                        margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="oklch(0.92 0.01 250)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          stroke="oklch(0.55 0.03 255)"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11 }}
                          stroke="oklch(0.55 0.03 255)"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          formatter={(v) => `${v}%`}
                          contentStyle={{
                            background: "white",
                            border: "1px solid oklch(0.91 0.015 250)",
                            borderRadius: 10,
                            fontSize: 12,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="rate"
                          stroke="oklch(0.7 0.13 160)"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: "oklch(0.7 0.13 160)" }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dues list + Top batches */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {canViewFees && (
              <Card className="border-border/60">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">
                      Students with pending fees
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sorted by amount owed — chase these first
                    </p>
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/fees">View all</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {dues.list.length === 0 ? (
                    <EmptyHint text="No pending dues. Great job!" />
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {dues.list.slice(0, 6).map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center justify-between py-3"
                        >
                          <div className="min-w-0">
                            <Link
                              to="/students/$id"
                              params={{ id: d.id }}
                              className="block truncate text-sm font-medium hover:underline"
                            >
                              {d.name}
                            </Link>
                            {d.dueDate && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {d.daysOverdue > 0
                                  ? `${d.daysOverdue} days overdue`
                                  : `Due in ${Math.abs(d.daysOverdue)} days`}
                              </p>
                            )}
                          </div>
                          <div className="ml-3 text-right">
                            <p className="text-sm font-semibold tabular-nums">
                              {formatINR(d.due)}
                            </p>
                            {d.daysOverdue > 0 && (
                              <Badge
                                variant="destructive"
                                className="mt-0.5 text-[10px]"
                              >
                                Overdue
                              </Badge>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">
                  Top batches by revenue
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Where your money comes from
                </p>
              </CardHeader>
              <CardContent>
                {topBatches.length === 0 ? (
                  <EmptyHint text="Add batches and record payments to see this" />
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer>
                      <BarChart
                        data={topBatches}
                        layout="vertical"
                        margin={{ left: 8, right: 16 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="oklch(0.92 0.01 250)"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11 }}
                          stroke="oklch(0.55 0.03 255)"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) =>
                            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                          }
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          stroke="oklch(0.55 0.03 255)"
                          tickLine={false}
                          axisLine={false}
                          width={90}
                        />
                        <Tooltip
                          formatter={(v) => formatINR(Number(v))}
                          contentStyle={{
                            background: "white",
                            border: "1px solid oklch(0.91 0.015 250)",
                            borderRadius: 10,
                            fontSize: 12,
                          }}
                        />
                        <Bar
                          dataKey="revenue"
                          fill="oklch(0.55 0.14 250)"
                          radius={[0, 6, 6, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* At-risk batches */}
          {batchAttendance.length > 0 && (
            <Card className="mt-6 border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Attendance by batch</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Batches below 75% need attention
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {batchAttendance.map((b) => {
                    const tone =
                      b.rate >= 80
                        ? "success"
                        : b.rate >= 60
                          ? "warning"
                          : "danger";
                    const bar =
                      tone === "success"
                        ? "bg-emerald-500"
                        : tone === "warning"
                          ? "bg-amber-500"
                          : "bg-rose-500";
                    return (
                      <div key={b.name}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="truncate font-medium">{b.name}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {b.rate}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              bar,
                            )}
                            style={{ width: `${b.rate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function HeroKpi({
  label,
  value,
  hint,
  deltaPct,
  icon: Icon,
  tone = "primary",
  spark,
}: {
  label: string;
  value: string;
  hint?: string;
  deltaPct?: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "warning" | "danger";
  spark?: number[];
}) {
  const tones = {
    primary: "from-indigo-50 to-blue-50 text-indigo-600 ring-indigo-100",
    success: "from-emerald-50 to-teal-50 text-emerald-600 ring-emerald-100",
    warning: "from-amber-50 to-orange-50 text-amber-600 ring-amber-100",
    danger: "from-rose-50 to-pink-50 text-rose-600 ring-rose-100",
  } as const;
  const isPos = (deltaPct ?? 0) >= 0;
  const max = spark && spark.length ? Math.max(...spark, 1) : 1;
  return (
    <Card className="relative overflow-hidden border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
            {(hint || deltaPct !== undefined) && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                {deltaPct !== undefined && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                      isPos
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700",
                    )}
                  >
                    {isPos ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownRight className="size-3" />
                    )}
                    {Math.abs(deltaPct)}%
                  </span>
                )}
                {hint && (
                  <span className="truncate text-muted-foreground">{hint}</span>
                )}
              </div>
            )}
          </div>
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1",
              tones[tone],
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
        {spark && spark.length > 1 && (
          <svg
            viewBox="0 0 100 24"
            className="mt-3 h-8 w-full"
            preserveAspectRatio="none"
          >
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={tones[tone]
                .split(" ")
                .find((c) => c.startsWith("text-"))}
              points={spark
                .map(
                  (v, i) =>
                    `${(i / (spark.length - 1)) * 100},${24 - (v / max) * 22}`,
                )
                .join(" ")}
            />
          </svg>
        )}
      </CardContent>
    </Card>
  );
}
