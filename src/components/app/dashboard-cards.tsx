import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  Clock,
  Sun,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/app/initials-avatar";
import { StackedBar } from "@/components/app/stacked-bar";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

export function GreetingBanner({
  greeting,
  displayName,
  instituteName,
  classesToday,
}: {
  greeting: string;
  displayName: string;
  instituteName?: string | null;
  classesToday: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-primary-soft/70 p-4 sm:p-5">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {format(new Date(), "d MMM yyyy")} · {format(new Date(), "EEEE")}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {greeting}, {displayName}
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {instituteName ? `${instituteName} · ` : ""}
            {classesToday === 0
              ? "No batches scheduled today"
              : `${classesToday} ${classesToday === 1 ? "batch" : "batches"} active today`}
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-xs">
          <Sun className="h-6 w-6" aria-hidden />
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-brand-teal/15 blur-2xl"
      />
    </section>
  );
}

export function QuickActions({
  canViewFees,
  canStudents,
  canAttendance,
}: {
  canViewFees: boolean;
  canStudents: boolean;
  canAttendance: boolean;
}) {
  const tiles = [
    canAttendance && {
      to: "/attendance" as const,
      label: "Mark Attendance",
      icon: CalendarCheck,
      primary: true,
    },
    canStudents && {
      to: "/students" as const,
      label: "Add Student",
      icon: UserPlus,
      primary: false,
    },
    canViewFees && {
      to: "/fees" as const,
      label: "Record Payment",
      icon: Wallet,
      primary: false,
    },
  ].filter(Boolean) as Array<{
    to: "/attendance" | "/students" | "/fees";
    label: string;
    icon: typeof CalendarCheck;
    primary: boolean;
  }>;

  if (tiles.length === 0) return null;

  return (
    <div
      className={cn(
        "grid gap-2",
        tiles.length === 3 ? "grid-cols-3" : "grid-cols-2",
      )}
    >
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <Link
            key={tile.to}
            to={tile.to}
            className={cn(
              "flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-center text-xs font-semibold leading-tight",
              "transition-[transform,background-color] duration-150 [transition-timing-function:var(--ease-out)]",
              "active:scale-[0.97] motion-reduce:active:scale-100",
              tile.primary
                ? "bg-primary text-primary-foreground shadow-sm [@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/90"
                : "bg-card text-foreground shadow-[var(--shadow-card)] ring-1 ring-border/80 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/50",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                tile.primary ? "bg-white/15" : "bg-primary-soft",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            {tile.label}
          </Link>
        );
      })}
    </div>
  );
}

export function TodayAttendanceCard({
  enrolled,
  present,
  absent,
  pending,
  nextBatch,
}: {
  enrolled: number;
  present: number;
  absent: number;
  pending: number;
  nextBatch?: {
    name: string;
    timing: string | null;
    students: number;
  } | null;
}) {
  const marked = present + absent;
  const pct = enrolled ? Math.round((marked / enrolled) * 100) : 0;
  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <CalendarCheck className="h-4.5 w-4.5 h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold">
                Today's attendance
              </h2>
              <p className="text-xs text-muted-foreground">
                {enrolled === 0
                  ? "No students scheduled today"
                  : `${enrolled} student${enrolled === 1 ? "" : "s"} in today's batches`}
              </p>
            </div>
          </div>
          {enrolled > 0 && (
            <span className="pill pill-brand shrink-0">{pct}% marked</span>
          )}
        </div>

        {enrolled > 0 && (
          <>
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-muted-foreground">
                {marked} marked of {enrolled}
              </span>
              <span>{pending} awaiting</span>
            </div>
            <StackedBar
              segments={[
                {
                  key: "present",
                  value: present,
                  className: "bg-success",
                  label: "Present",
                },
                {
                  key: "absent",
                  value: absent,
                  className: "bg-destructive",
                  label: "Absent",
                },
                {
                  key: "pending",
                  value: pending,
                  className: "bg-muted-foreground/25",
                  label: "Pending",
                },
              ]}
            />
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Present", value: present, dot: "bg-success" },
                { label: "Absent", value: absent, dot: "bg-destructive" },
                {
                  label: "Pending",
                  value: pending,
                  dot: "bg-muted-foreground/40",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl bg-muted/40 px-2 py-2 text-center"
                >
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                    {s.label}
                  </div>
                  <p className="mt-0.5 font-display text-lg font-bold tabular-nums">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {nextBatch && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Clock className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {nextBatch.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {nextBatch.timing ? `${nextBatch.timing} · ` : ""}
                  {nextBatch.students} student
                  {nextBatch.students === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <Link to="/attendance">Mark now</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CollectionCard({
  monthCollected,
  prevMonthCollected,
  collectionDeltaPct,
}: {
  monthCollected: number;
  prevMonthCollected: number;
  collectionDeltaPct?: number;
}) {
  const ahead = monthCollected - prevMonthCollected;
  return (
    <Card>
      <CardContent className="flex flex-col justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="type-kicker text-muted-foreground">
              Collected this month
            </p>
            <p className="mt-1 font-display text-3xl font-bold leading-none tracking-tight tabular-nums">
              {formatINR(monthCollected)}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Wallet className="h-5 w-5" aria-hidden />
          </div>
        </div>
        {prevMonthCollected > 0 && typeof collectionDeltaPct === "number" ? (
          <p
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              ahead >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {ahead >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
            )}
            {formatINR(Math.abs(ahead))} {ahead >= 0 ? "ahead of" : "behind"}{" "}
            last month ({collectionDeltaPct}
            %)
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Last month: {formatINR(prevMonthCollected)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function OverdueActionCard({
  overdueCount,
  overdueAmount,
}: {
  overdueCount: number;
  overdueAmount: number;
}) {
  if (overdueCount === 0) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-5">
          <p className="type-kicker text-success">All clear</p>
          <p className="mt-1 font-display text-xl font-bold">No overdue dues</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing waiting on collections right now.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-destructive/20">
      <CardContent className="flex flex-col justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 type-kicker text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              Action required
            </p>
            <p className="mt-1 font-display text-3xl font-bold leading-none tracking-tight tabular-nums text-destructive">
              {formatINR(overdueAmount)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Overdue across {overdueCount}{" "}
              {overdueCount === 1 ? "student" : "students"}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
        </div>
        <Button asChild variant="secondary" className="w-full justify-between">
          <Link to="/fees" search={{ status: "overdue" }}>
            View overdue list
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function AttendanceTrend({
  days,
}: {
  days: { label: string; pct: number | null }[];
}) {
  const max = 100;
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            Weekly attendance
          </h2>
          <span className="text-xs text-muted-foreground">Last 5 days</span>
        </div>
        <div className="flex h-28 items-end justify-between gap-2">
          {days.map((d) => {
            const height = d.pct == null ? 8 : Math.max(8, (d.pct / max) * 100);
            const isToday = d === days[days.length - 1];
            return (
              <div
                key={d.label}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
              >
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {d.pct == null ? "—" : `${d.pct}%`}
                </span>
                <div
                  className={cn(
                    "w-full rounded-t-lg",
                    isToday ? "bg-primary" : "bg-primary-soft",
                  )}
                  style={{ height: `${height}%` }}
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function RecentActivity({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    meta: string;
    tone?: "success" | "danger" | "default";
    paymentId?: string;
  }>;
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">
            Recent activity
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/fees">See all</Link>
          </Button>
        </div>
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const inner = (
              <div className="flex items-center gap-3 py-3">
                <InitialsAvatar name={item.title} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-xs font-semibold",
                    item.tone === "success"
                      ? "text-success"
                      : item.tone === "danger"
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {item.meta}
                </span>
              </div>
            );
            return (
              <li key={item.id}>
                {item.paymentId ? (
                  <Link
                    to="/receipts/$paymentId"
                    params={{ paymentId: item.paymentId }}
                    className="block rounded-lg px-1 min-h-11 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
