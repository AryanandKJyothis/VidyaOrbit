import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { usePrefers } from "@/hooks/use-prefers";
import { fadeOnly, springDefault } from "@/lib/motion";
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
import {
  addCalendarDaysISO,
  formatDate,
  formatINR,
  isPastIstDate,
  istMonthStartISO,
  istPrevMonthRangeISO,
  istWeekdayKey,
  istWeekdayLong,
  todayISO,
} from "@/lib/format";
import {
  dashboardAttendanceSinceISO,
  fetchDashboardAttendanceRows,
} from "@/lib/dashboard-attendance";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  QueryErrorState,
  QueryLoadingSkeleton,
} from "@/components/query-state";
import { EmptyState } from "@/components/empty-state";
import {
  useStudents,
  useBatches,
  usePayments,
  useInstitute,
} from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

import { OwnerGettingStartedCard } from "@/components/onboarding-checklist";
import { DigestReminderBootstrap } from "@/components/digest-reminder";
import {
  GreetingBanner,
  QuickActions,
  TodayAttendanceCard,
  CollectionCard,
  OverdueActionCard,
  AttendanceTrend,
  RecentActivity,
} from "@/components/app/dashboard-cards";
import { OverLimitBanner } from "@/components/over-limit-banner";
import { ExpiryBanner } from "@/components/expiry-banner";
import { WelcomeBackBanner } from "@/components/welcome-back-banner";
import { useActiveWorkspace, useCan } from "@/hooks/use-active-workspace";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const institute = useInstitute();
  const students = useStudents();
  const batches = useBatches();
  const payments = usePayments();
  const qc = useQueryClient();
  const { active } = useActiveWorkspace();
  const canViewFees = useCan("fees", "read");
  const canStudents = useCan("students");
  const canAttendance = useCan("attendance");
  const { dismissedChecklist } = useOnboarding();
  const { reducedMotion } = usePrefers();
  const itemTransition = reducedMotion ? fadeOnly : springDefault;

  const attendance = useQuery({
    queryKey: ["att-summary", active?.ownerId],
    enabled: !!active?.ownerId,
    queryFn: async () => {
      const since = dashboardAttendanceSinceISO();
      return fetchDashboardAttendanceRows((from, to) =>
        supabase
          .from("attendance_records")
          .select("status, created_at, attendance_sessions!inner(session_date)")
          .eq("owner_id", active!.ownerId)
          .gte("attendance_sessions.session_date", since)
          .range(from, to),
      );
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
        isPastIstDate(st.fee_due_date) &&
        Number(st.fee_total) - (totalPaidByStudent[st.id] ?? 0) > 0,
    );
    const overdueAmount = overdue.reduce(
      (sum, st) =>
        sum +
        Math.max(0, Number(st.fee_total) - (totalPaidByStudent[st.id] ?? 0)),
      0,
    );
    const partialCount = s.filter((st) => {
      if (st.status === "archived") return false;
      const paid = totalPaidByStudent[st.id] ?? 0;
      const balance = Math.max(0, Number(st.fee_total) - paid);
      const isOverdue = !!(
        st.fee_due_date &&
        isPastIstDate(st.fee_due_date) &&
        balance > 0
      );
      return paid > 0 && balance > 0 && !isOverdue;
    }).length;

    const todayStr = todayISO();
    const weekAheadStr = addCalendarDaysISO(todayStr, 7);
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
    const monthStart = istMonthStartISO();
    const monthCollected = p
      .filter((x) => x.payment_date >= monthStart)
      .reduce((sum, x) => sum + Number(x.amount), 0);

    // Previous full month (for delta)
    const { start: prevMonthStart, end: prevMonthEnd } = istPrevMonthRangeISO();
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
    const dowKey = istWeekdayKey();
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
      partialCount,
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
    const today = todayISO();
    for (let i = 13; i >= 0; i--) {
      const key = addCalendarDaysISO(today, -i);
      days.push({
        date: key,
        label: formatDate(key).replace(/ \d{4}$/, ""),
        amount: 0,
      });
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
    const today = todayISO();
    for (let i = 13; i >= 0; i--) {
      days.push({ date: addCalendarDaysISO(today, -i), total: 0, present: 0 });
    }
    for (const a of att) {
      // Use session_date (class date) instead of created_at (mark time)
      const k =
        a.attendance_sessions?.session_date ?? a.created_at.slice(0, 10);
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

  const todayKey = todayISO();
  const todayAtt = useMemo(() => {
    const att = attendance.data ?? [];
    const enrolled = (students.data ?? []).filter(
      (st) =>
        st.status !== "archived" &&
        st.batch_id &&
        stats.todaysBatches.some((b) => b.id === st.batch_id),
    );
    let present = 0;
    let absent = 0;
    for (const a of att) {
      const day =
        a.attendance_sessions?.session_date ?? a.created_at.slice(0, 10);
      if (day !== todayKey) continue;
      if (a.status === "present" || a.status === "late") present += 1;
      else if (a.status === "absent") absent += 1;
    }
    const marked = present + absent;
    const pending = Math.max(0, enrolled.length - marked);
    const next = stats.todaysBatches[0];
    const nextStudents = next
      ? (students.data ?? []).filter(
          (st) => st.batch_id === next.id && st.status !== "archived",
        ).length
      : 0;
    return {
      enrolled: enrolled.length,
      present,
      absent,
      pending,
      nextBatch: next
        ? { name: next.name, timing: next.timing, students: nextStudents }
        : null,
    };
  }, [attendance.data, students.data, stats.todaysBatches, todayKey]);

  const weekTrend = useMemo(() => {
    const att = attendance.data ?? [];
    const days: { label: string; pct: number | null }[] = [];
    const today = todayISO();
    for (let i = 4; i >= 0; i--) {
      const key = addCalendarDaysISO(today, -i);
      let total = 0;
      let present = 0;
      for (const a of att) {
        const day =
          a.attendance_sessions?.session_date ?? a.created_at.slice(0, 10);
        if (day !== key) continue;
        total += 1;
        if (a.status === "present" || a.status === "late") present += 1;
      }
      days.push({
        label: new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          weekday: "short",
        }).format(new Date(`${key}T12:00:00+05:30`)),
        pct: total ? Math.round((present / total) * 100) : null,
      });
    }
    return days;
  }, [attendance.data]);

  const activityItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
      meta: string;
      tone?: "success" | "danger" | "default";
      paymentId?: string;
    }> = [];
    for (const p of (payments.data ?? []).slice(0, 6)) {
      items.push({
        id: p.id,
        title: studentById[p.student_id] ?? "Student",
        subtitle: `${formatDate(p.payment_date)} · ${p.method.toUpperCase()}`,
        meta: formatINR(Number(p.amount)),
        tone: "success",
        paymentId: p.id,
      });
    }
    return items;
  }, [payments.data, studentById]);

  const { user } = useAuth();
  const firstName =
    ((user?.user_metadata?.full_name as string | undefined) ?? "")
      .trim()
      .split(/\s+/)[0] || "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? "Working late"
      : hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : hour < 21
            ? "Good evening"
            : "Good night";

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
      <OwnerGettingStartedCard />

      <div className="space-y-3 sm:space-y-4">
        <GreetingBanner
          greeting={greeting}
          displayName={firstName}
          instituteName={institute.data?.name ?? null}
          classesToday={stats.todaysBatches.length}
        />
        <QuickActions
          canViewFees={canViewFees}
          canStudents={canStudents}
          canAttendance={canAttendance}
        />
      </div>

      {!loading &&
        dismissedChecklist &&
        !students.isError &&
        stats.totalStudents === 0 &&
        (batches.data?.length ?? 0) === 0 && (
          <EmptyState
            className="mb-6"
            icon={Users}
            title="Your institute is ready"
            description="Add a batch, then enrol students. The dashboard fills in as you run attendance and collect fees."
          >
            <Button asChild>
              <Link to="/batches">Create a batch</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/students">Add students</Link>
            </Button>
          </EmptyState>
        )}

      {loading && (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      )}

      {!loading && (
        <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
          <TodayAttendanceCard
            enrolled={todayAtt.enrolled}
            present={todayAtt.present}
            absent={todayAtt.absent}
            pending={todayAtt.pending}
            nextBatch={todayAtt.nextBatch}
          />
          {canViewFees && (
            <div className="grid gap-3 sm:grid-cols-2">
              <CollectionCard
                monthCollected={stats.monthCollected}
                prevMonthCollected={stats.prevMonthCollected}
                collectionDeltaPct={stats.collectionDelta}
              />
              <OverdueActionCard
                overdueCount={stats.overdue.length}
                overdueAmount={stats.overdueAmount}
              />
            </div>
          )}
          <AttendanceTrend days={weekTrend} />
          {canViewFees && <RecentActivity items={activityItems} />}
        </div>
      )}

      {/* KPI strip — desktop density */}
      <div className="mt-6 hidden grid-cols-2 gap-4 md:grid lg:grid-cols-5">
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
            onRetry={() => {
              void qc.invalidateQueries({ queryKey: ["students"] });
              void qc.invalidateQueries({ queryKey: ["batches"] });
              void qc.invalidateQueries({ queryKey: ["payments"] });
            }}
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
            {canViewFees && (
              <>
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
                  hint={`${stats.overdue.length} overdue · ${stats.partialCount} partial`}
                  icon={AlertCircle}
                  tone={stats.overdue.length ? "destructive" : "default"}
                />
              </>
            )}
            <StatCard
              index={canViewFees ? 4 : 2}
              label="Attendance"
              value={`${stats.attRate}%`}
              hint="Last 30 days"
              icon={CalendarCheck}
              sparkline={attendanceSpark}
            />
          </>
        )}
      </div>

      {/* Fee collection chart */}
      {canViewFees && (
        <div className="mt-6 sm:mt-8">
          <Card className="card-premium">
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
                <QueryErrorState
                  error={payments.error as Error}
                  onRetry={() =>
                    qc.invalidateQueries({ queryKey: ["payments"] })
                  }
                />
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
                          <stop
                            offset="100%"
                            stopColor="oklch(0.32 0.10 255)"
                          />
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
        </div>
      )}

      {/* Today's batches */}
      <div className="mt-6 sm:mt-8">
        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">
                Today's batches
              </CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {istWeekdayLong()}
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
                {(batches.data ?? []).length === 0
                  ? "No batches yet — create one to schedule classes."
                  : "No classes scheduled for today."}
              </div>
            ) : (
              stats.todaysBatches.slice(0, 5).map((b, i) => {
                const count = (students.data ?? []).filter(
                  (s) => s.batch_id === b.id && s.status !== "archived",
                ).length;
                return (
                  <motion.div
                    key={b.id}
                    initial={
                      reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      ...itemTransition,
                      delay: reducedMotion ? 0 : i * 0.04,
                    }}
                    className="group flex items-center justify-between gap-3 rounded-lg border border-subtle bg-card p-3 transition-[background-color] duration-100 hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {b.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
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
      {canViewFees && (
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
                <Link to="/fees" search={{ status: "overdue" }}>
                  Collect
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.overdue.length === 0 ? (
                <div className="rounded-lg border border-dashed border-subtle p-5 text-center text-xs sm:text-sm text-muted-foreground">
                  {stats.totalStudents === 0
                    ? "Add students with fee totals to track dues here."
                    : "No overdue dues right now."}
                </div>
              ) : (
                stats.overdue.slice(0, 6).map((s, i) => {
                  const balance =
                    Number(s.fee_total) - (stats.totalPaidByStudent[s.id] ?? 0);
                  return (
                    <motion.div
                      key={s.id}
                      initial={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        ...itemTransition,
                        delay: reducedMotion ? 0 : i * 0.03,
                      }}
                      className="flex items-center justify-between rounded-lg border border-subtle bg-card p-3 transition-colors duration-100 hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/students/$id"
                          params={{ id: s.id }}
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {s.full_name}
                        </Link>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Due {formatDate(s.fee_due_date)}
                        </div>
                      </div>
                      <Badge
                        variant="destructive"
                        className="font-mono text-xs ml-2 shrink-0"
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
                <EmptyState
                  className="border-0 bg-transparent py-8"
                  title="No payments yet"
                  description="Record the first fee collection to see receipts and recent activity here."
                >
                  <Button asChild size="sm">
                    <Link to="/fees">Record a payment</Link>
                  </Button>
                </EmptyState>
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
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(p.payment_date)} ·{" "}
                          {p.method.toUpperCase()}
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
      )}
    </div>
  );
}
