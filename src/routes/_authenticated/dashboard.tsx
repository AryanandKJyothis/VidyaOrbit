import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users,
  Layers,
  Wallet,
  AlertCircle,
  CalendarCheck,
  TrendingUp,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format, subDays, startOfMonth, addDays } from "date-fns";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  QueryErrorState,
  QueryLoadingSkeleton,
} from "@/components/query-state";
import {
  useStudents,
  useBatches,
  usePayments,
  useInstitute,
} from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatDate } from "@/lib/format";

import { SetupPrompt } from "@/components/setup-prompt";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { DigestReminderBootstrap } from "@/components/digest-reminder";
import { DashboardHero } from "@/components/dashboard-hero";
import { DashboardSpotlight } from "@/components/dashboard-spotlight";
import { OverLimitBanner } from "@/components/over-limit-banner";
import { ExpiryBanner } from "@/components/expiry-banner";
import { WelcomeBackBanner } from "@/components/welcome-back-banner";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

// Postgres EXTRACT(dow) → 0=Sun..6=Sat. Match against batch.days_of_week
// which is stored as 3-letter strings in this app (mon/tue/...).
const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function Dashboard() {
  const institute = useInstitute();
  const students = useStudents();
  const batches = useBatches();
  const payments = usePayments();
  const { active } = useActiveWorkspace();

  const attendance = useQuery({
    queryKey: ["att-summary", active?.ownerId],
    enabled: !!active?.ownerId,
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("attendance_records")
        .select("status, created_at")
        .eq("owner_id", active!.ownerId)
        .gte("created_at", since);
      if (error) throw error;
      return data as { status: string; created_at: string }[];
    },
  });

  const stats = useMemo(() => {
    const s = students.data ?? [];
    const b = batches.data ?? [];
    const p = payments.data ?? [];
    const totalPaidByStudent: Record<string, number> = {};
    for (const pay of p)
      totalPaidByStudent[pay.student_id] =
        (totalPaidByStudent[pay.student_id] ?? 0) + Number(pay.amount);
    const totalCollected = p.reduce((sum, x) => sum + Number(x.amount), 0);
    const totalDues = s
      .filter((st) => st.status !== "archived")
      .reduce(
        (sum, st) =>
          sum +
          Math.max(0, Number(st.fee_total) - (totalPaidByStudent[st.id] ?? 0)),
        0,
      );
    const overdue = s.filter(
      (st) =>
        st.status !== "archived" &&
        st.fee_due_date &&
        new Date(st.fee_due_date) < new Date() &&
        Number(st.fee_total) - (totalPaidByStudent[st.id] ?? 0) > 0,
    );
    const overdueAmount = overdue.reduce(
      (sum, st) =>
        sum +
        Math.max(0, Number(st.fee_total) - (totalPaidByStudent[st.id] ?? 0)),
      0,
    );

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const weekAheadStr = format(addDays(new Date(), 7), "yyyy-MM-dd");
    const duesWeekAmount = s
      .filter((st) => st.status !== "archived")
      .reduce((sum, st) => {
        const balance = Math.max(
          0,
          Number(st.fee_total) - (totalPaidByStudent[st.id] ?? 0),
        );
        if (balance <= 0 || !st.fee_due_date) return sum;
        if (st.fee_due_date >= todayStr && st.fee_due_date <= weekAheadStr)
          return sum + balance;
        return sum;
      }, 0);
    const att = attendance.data ?? [];
    const present = att.filter(
      (a) => a.status === "present" || a.status === "late",
    ).length;
    const attRate = att.length ? Math.round((present / att.length) * 100) : 0;
    const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);
    const monthCollected = p
      .filter((x) => x.payment_date >= monthStart)
      .reduce((sum, x) => sum + Number(x.amount), 0);

    // Previous full month (for delta)
    const prevMonthStart = format(
      new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
      "yyyy-MM-dd",
    );
    const prevMonthEnd = format(
      new Date(new Date().getFullYear(), new Date().getMonth(), 0),
      "yyyy-MM-dd",
    );
    const prevMonthCollected = p
      .filter(
        (x) =>
          x.payment_date >= prevMonthStart && x.payment_date <= prevMonthEnd,
      )
      .reduce((sum, x) => sum + Number(x.amount), 0);
    const collectionDelta = prevMonthCollected
      ? Math.round(
          ((monthCollected - prevMonthCollected) / prevMonthCollected) * 100,
        )
      : undefined;

    // Today's batches based on days_of_week
    const dowKey = DOW_KEYS[new Date().getDay()];
    const todaysBatches = b.filter(
      (x) =>
        x.is_active &&
        (x.days_of_week ?? []).map((d) => d.toLowerCase()).includes(dowKey),
    );

    // New admissions: this month vs previous month (by joining_date)
    const thisMonthStart = monthStart;
    const newAdmissionsThisMonth = s.filter(
      (st) =>
        st.status !== "archived" &&
        st.joining_date &&
        st.joining_date >= thisMonthStart,
    ).length;
    const prevAdmissions = s.filter(
      (st) =>
        st.status !== "archived" &&
        st.joining_date &&
        st.joining_date >= prevMonthStart &&
        st.joining_date <= prevMonthEnd,
    ).length;

    return {
      totalStudents: s.filter((st) => st.status === "active").length,
      activeBatches: b.filter((x) => x.is_active).length,
      totalCollected,
      monthCollected,
      prevMonthCollected,
      collectionDelta,
      totalDues,
      overdue,
      overdueAmount,
      duesWeekAmount,
      attRate,
      totalPaidByStudent,
      todaysBatches,
      newAdmissionsThisMonth,
      prevAdmissions,
    };
  }, [students.data, batches.data, payments.data, attendance.data]);

  // 14-day collection chart + sparkline trends
  const collectionSeries = useMemo(() => {
    const p = payments.data ?? [];
    const days: { date: string; label: string; amount: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "yyyy-MM-dd");
      days.push({ date: key, label: format(d, "d MMM"), amount: 0 });
    }
    for (const pay of p) {
      const day = days.find((d) => d.date === pay.payment_date);
      if (day) day.amount += Number(pay.amount);
    }
    return days;
  }, [payments.data]);

  const collectionSpark = useMemo(
    () => collectionSeries.map((d) => d.amount),
    [collectionSeries],
  );
  const attendanceSpark = useMemo(() => {
    const att = attendance.data ?? [];
    const days: { date: string; total: number; present: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = subDays(new Date(), i);
      days.push({ date: format(d, "yyyy-MM-dd"), total: 0, present: 0 });
    }
    for (const a of att) {
      const k = a.created_at.slice(0, 10);
      const day = days.find((d) => d.date === k);
      if (day) {
        day.total += 1;
        if (a.status === "present" || a.status === "late") day.present += 1;
      }
    }
    return days.map((d) =>
      d.total ? Math.round((d.present / d.total) * 100) : 0,
    );
  }, [attendance.data]);

  const loading = students.isLoading || batches.isLoading || payments.isLoading;
  const studentById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of students.data ?? []) map[s.id] = s.full_name;
    return map;
  }, [students.data]);

  return (
    <div>
      <DigestReminderBootstrap
        overdueCount={stats.overdue.length}
        overdueAmount={stats.overdueAmount}
        duesWeekAmount={stats.duesWeekAmount}
        attendancePct={stats.attRate}
      />
      <WelcomeBackBanner />
      <ExpiryBanner />
      <OverLimitBanner />
      <SetupPrompt />
      <OnboardingChecklist
        institute={institute.data}
        batches={batches.data}
        students={students.data}
        payments={payments.data}
      />

      <DashboardHero
        instituteName={institute.data?.name ?? null}
        classesToday={stats.todaysBatches.length}
        studentsActive={stats.totalStudents}
        duesWeekAmount={stats.duesWeekAmount}
      />

      {!loading && (
        <DashboardSpotlight
          overdueCount={stats.overdue.length}
          overdueAmount={stats.overdueAmount}
          duesWeekAmount={stats.duesWeekAmount}
          attendancePct={stats.attRate}
          monthCollected={stats.monthCollected}
          prevMonthCollected={stats.prevMonthCollected}
          collectionDeltaPct={stats.collectionDelta}
          newAdmissionsThisMonth={stats.newAdmissionsThisMonth}
          prevAdmissions={stats.prevAdmissions}
          classesToday={stats.todaysBatches.length}
          totalStudents={stats.totalStudents}
        />
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 sm:gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-32 sm:h-[148px] rounded-xl skeleton-shimmer"
            />
          ))
        ) : students.isError || batches.isError || payments.isError ? (
          <QueryErrorState
            error={
              students.isError
                ? (students.error as Error)
                : batches.isError
                  ? (batches.error as Error)
                  : (payments.error as Error)
            }
            title="Failed to load statistics"
          />
        ) : (
          <>
            <StatCard
              index={0}
              label="Students"
              value={String(stats.totalStudents)}
              hint="Active"
              icon={Users}
            />
            <StatCard
              index={1}
              label="Batches"
              value={String(stats.activeBatches)}
              hint={`${stats.todaysBatches.length} today`}
              icon={Layers}
            />
            <StatCard
              index={2}
              label="Collected"
              value={formatINR(stats.monthCollected)}
              hint="This month"
              icon={Wallet}
              tone="success"
              sparkline={collectionSpark}
              deltaPct={stats.collectionDelta}
            />
            <StatCard
              index={3}
              label="Dues"
              value={formatINR(stats.totalDues)}
              hint={`${stats.overdue.length} overdue`}
              icon={AlertCircle}
              tone={stats.overdue.length ? "destructive" : "default"}
            />
            <StatCard
              index={4}
              label="Attendance"
              value={`${stats.attRate}%`}
              hint="Last 30 days"
              icon={CalendarCheck}
              sparkline={attendanceSpark}
            />
          </>
        )}
      </div>

      {/* Today's batches + Collection chart */}
      <div className="mt-6 sm:mt-8 grid gap-6 lg:grid-cols-3 auto-rows-max">
        <Card className="card-premium lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">
                Fee collection
              </CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Last 14 days
              </p>
            </div>
            <TrendingUp
              className="h-5 w-5 text-muted-foreground mt-2 sm:mt-0 shrink-0"
              aria-hidden
            />
          </CardHeader>
          <CardContent>
            {payments.isError ? (
              <QueryErrorState error={payments.error as Error} />
            ) : payments.isLoading ? (
              <QueryLoadingSkeleton
                count={1}
                className="h-[200px] sm:h-[240px]"
              />
            ) : (
              <div className="h-[200px] sm:h-[240px] w-full -mx-4 sm:mx-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={collectionSeries}
                    margin={{ left: -10, right: 6, top: 6, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="collectArea"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="oklch(0.55 0.14 220)"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="100%"
                          stopColor="oklch(0.55 0.14 220)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="collectStroke"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor="oklch(0.7 0.12 185)" />
                        <stop offset="100%" stopColor="oklch(0.32 0.10 255)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.92 0.008 245)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      stroke="oklch(0.52 0.03 255)"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="oklch(0.52 0.03 255)"
                      tickFormatter={(v) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "white",
                        border: "1px solid oklch(0.92 0.008 245)",
                        borderRadius: 10,
                        fontSize: 11,
                        boxShadow: "0 8px 24px -8px rgba(15,42,72,0.18)",
                      }}
                      formatter={(v) => formatINR(Number(v))}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="url(#collectStroke)"
                      strokeWidth={2.5}
                      fill="url(#collectArea)"
                      dot={false}
                      activeDot={{ r: 5, fill: "oklch(0.32 0.10 255)" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's batches */}
        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">
                Today's batches
              </CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {format(new Date(), "EEEE")}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/batches">All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {batches.isLoading ? (
              <QueryLoadingSkeleton count={3} className="h-14" />
            ) : stats.todaysBatches.length === 0 ? (
              <div className="rounded-lg border border-dashed border-subtle p-5 text-center text-xs sm:text-sm text-muted-foreground">
                No classes scheduled today. Enjoy the break! ☕
              </div>
            ) : (
              stats.todaysBatches.slice(0, 5).map((b, i) => {
                const count = (students.data ?? []).filter(
                  (s) => s.batch_id === b.id && s.status !== "archived",
                ).length;
                return (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="group flex items-center justify-between gap-3 rounded-lg border border-subtle bg-card p-3 hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {b.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {b.timing && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {b.timing}
                          </span>
                        )}
                        <span>·</span>
                        <span>
                          {count}/{b.capacity}
                        </span>
                      </div>
                    </div>
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                    >
                      <Link to="/attendance">
                        Mark
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </motion.div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue + Recent payments */}
      <div className="mt-6 sm:mt-8 grid gap-6 lg:grid-cols-2 auto-rows-max">
        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base sm:text-lg">
                Overdue dues
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.overdue.length === 0
                  ? "All clear"
                  : `${stats.overdue.length} students · ${formatINR(stats.overdueAmount)}`}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/fees">Collect</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.overdue.length === 0 ? (
              <div className="rounded-lg border border-dashed border-subtle p-5 text-center text-xs sm:text-sm text-muted-foreground">
                No overdue dues. 🎉
              </div>
            ) : (
              stats.overdue.slice(0, 6).map((s, i) => {
                const balance =
                  Number(s.fee_total) - (stats.totalPaidByStudent[s.id] ?? 0);
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between rounded-lg border border-subtle bg-card p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/students/$id"
                        params={{ id: s.id }}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {s.full_name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Due {formatDate(s.fee_due_date)}
                      </div>
                    </div>
                    <Badge
                      variant="destructive"
                      className="font-mono text-[11px] ml-2 shrink-0"
                    >
                      {formatINR(balance)}
                    </Badge>
                  </motion.div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base sm:text-lg">
              Recent payments
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/fees">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(payments.data?.length ?? 0) === 0 ? (
              <EmptyHint text="No payments recorded yet." />
            ) : (
              <div className="divide-y divide-border space-y-1">
                {payments.data!.slice(0, 6).map((p) => (
                  <Link
                    key={p.id}
                    to="/receipts/$paymentId"
                    params={{ paymentId: p.id }}
                    className="flex items-center justify-between py-3 hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-sm">
                        {studentById[p.student_id] ?? "Student"}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDate(p.payment_date)} · {p.method.toUpperCase()}
                      </div>
                    </div>
                    <div className="font-mono text-sm font-semibold ml-2 shrink-0 tabular-nums">
                      {formatINR(Number(p.amount))}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-subtle p-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
