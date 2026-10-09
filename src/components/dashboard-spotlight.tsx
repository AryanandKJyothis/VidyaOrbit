import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  CalendarX,
  Wallet,
  PartyPopper,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePrefers } from "@/hooks/use-prefers";
import { fadeOnly, springDefault } from "@/lib/motion";
import { formatINR } from "@/lib/format";

type Tone = "danger" | "warning" | "celebrate" | "growth" | "info";

export type SpotlightInput = {
  overdueCount: number;
  overdueAmount: number;
  duesWeekAmount: number;
  attendancePct: number; // 0-100, last 30d
  attendanceDeltaPct?: number; // vs prior 30d
  monthCollected: number;
  prevMonthCollected: number;
  collectionDeltaPct?: number;
  newAdmissionsThisMonth: number;
  prevAdmissions: number;
  classesToday: number;
  totalStudents: number;
};

type Spotlight = {
  tone: Tone;
  eyebrow: string;
  title: string;
  subtitle: string;
  metric: string;
  metricLabel: string;
  icon: LucideIcon;
  cta: { label: string; to: string };
  // 0-100, progress toward a "good" state (used for the visual bar)
  progress: number;
  progressHint: string;
};

const toneStyles: Record<
  Tone,
  { ring: string; bar: string; chip: string; glow: string; iconBg: string }
> = {
  danger: {
    ring: "border-destructive/30",
    bar: "from-destructive via-brand-coral to-destructive",
    chip: "bg-destructive/10 text-destructive border-destructive/20",
    glow: "from-destructive/15",
    iconBg: "bg-destructive text-destructive-foreground",
  },
  warning: {
    ring: "border-brand-saffron/30",
    bar: "from-brand-saffron via-brand-sun to-brand-saffron",
    chip: "bg-brand-saffron/10 text-brand-saffron border-brand-saffron/20",
    glow: "from-brand-saffron/15",
    iconBg: "bg-warning text-warning-foreground",
  },
  celebrate: {
    ring: "border-success/30",
    bar: "from-success via-brand-teal to-success",
    chip: "bg-success/10 text-success border-success/20",
    glow: "from-success/15",
    iconBg: "bg-success text-success-foreground",
  },
  growth: {
    ring: "border-primary/30",
    bar: "from-primary via-brand-teal to-primary",
    chip: "bg-primary/10 text-primary border-primary/20",
    glow: "from-primary/15",
    iconBg: "bg-primary text-primary-foreground",
  },
  info: {
    ring: "border-subtle",
    bar: "from-primary via-brand-teal to-primary",
    chip: "bg-muted text-foreground border-subtle",
    glow: "from-primary/10",
    iconBg: "bg-primary text-primary-foreground",
  },
};

function pickSpotlight(i: SpotlightInput): Spotlight {
  // Priority 1 — Money at risk (most painful problem for a tuition centre)
  if (i.overdueCount > 0 && i.overdueAmount > 0) {
    return {
      tone: "danger",
      eyebrow: "Needs attention now",
      title: `${formatINR(i.overdueAmount)} overdue across ${i.overdueCount} ${i.overdueCount === 1 ? "student" : "students"}`,
      subtitle:
        "Send a polite reminder or record a payment to clear these dues.",
      metric: formatINR(i.overdueAmount),
      metricLabel: "Overdue balance",
      icon: AlertTriangle,
      cta: { label: "Collect dues", to: "/fees" },
      progress: 100,
      progressHint: `${i.overdueCount} ${i.overdueCount === 1 ? "case" : "cases"} pending`,
    };
  }

  // Priority 2 — Attendance dropping (leading indicator of churn)
  if (i.attendancePct > 0 && i.attendancePct < 75) {
    return {
      tone: "warning",
      eyebrow: "Watch closely",
      title: `Attendance is ${i.attendancePct}% — below the 75% safety line`,
      subtitle:
        "Students missing classes often quit. Identify at-risk batches before next week.",
      metric: `${i.attendancePct}%`,
      metricLabel: "Last 30 days",
      icon: CalendarX,
      cta: { label: "Open analytics", to: "/analytics" },
      progress: i.attendancePct,
      progressHint: "Target: 75% +",
    };
  }

  // Priority 3 — Collection slowing month-over-month (>20% drop)
  if (
    i.prevMonthCollected > 0 &&
    typeof i.collectionDeltaPct === "number" &&
    i.collectionDeltaPct <= -20
  ) {
    return {
      tone: "warning",
      eyebrow: "Revenue dip",
      title: `Collection down ${Math.abs(i.collectionDeltaPct)}% vs last month`,
      subtitle: `You've collected ${formatINR(i.monthCollected)} so far — chase pending fees to recover.`,
      metric: formatINR(i.monthCollected),
      metricLabel: "This month",
      icon: TrendingDown,
      cta: { label: "Review fees", to: "/fees" },
      progress: Math.max(
        10,
        Math.round(
          (i.monthCollected / Math.max(1, i.prevMonthCollected)) * 100,
        ),
      ),
      progressHint: `Last month: ${formatINR(i.prevMonthCollected)}`,
    };
  }

  // Priority 4 — Strong revenue growth (celebrate)
  if (
    i.prevMonthCollected > 0 &&
    typeof i.collectionDeltaPct === "number" &&
    i.collectionDeltaPct >= 20
  ) {
    return {
      tone: "celebrate",
      eyebrow: "You're crushing it",
      title: `Collection up ${i.collectionDeltaPct}% — your best month in a while`,
      subtitle: `${formatINR(i.monthCollected)} collected this month vs ${formatINR(i.prevMonthCollected)} last month.`,
      metric: `+${i.collectionDeltaPct}%`,
      metricLabel: "vs last month",
      icon: TrendingUp,
      cta: { label: "See trend", to: "/analytics" },
      progress: 100,
      progressHint: "Keep the momentum going",
    };
  }

  // Priority 5 — Healthy attendance celebration
  if (i.attendancePct >= 90) {
    return {
      tone: "celebrate",
      eyebrow: "Healthy classroom",
      title: `${i.attendancePct}% attendance — your students show up`,
      subtitle:
        "High attendance is the #1 predictor of renewals. Excellent retention signal.",
      metric: `${i.attendancePct}%`,
      metricLabel: "Last 30 days",
      icon: PartyPopper,
      cta: { label: "See breakdown", to: "/analytics" },
      progress: i.attendancePct,
      progressHint: "Elite tier (≥90%)",
    };
  }

  // Priority 6 — New admissions momentum
  if (
    i.newAdmissionsThisMonth > 0 &&
    i.newAdmissionsThisMonth >= i.prevAdmissions
  ) {
    const delta = i.prevAdmissions
      ? Math.round(
          ((i.newAdmissionsThisMonth - i.prevAdmissions) / i.prevAdmissions) *
            100,
        )
      : 100;
    return {
      tone: "growth",
      eyebrow: "Growing",
      title: `${i.newAdmissionsThisMonth} new ${i.newAdmissionsThisMonth === 1 ? "admission" : "admissions"} this month`,
      subtitle:
        i.prevAdmissions > 0
          ? `${delta >= 0 ? "+" : ""}${delta}% vs last month — onboard them well to lock in retention.`
          : "Welcome them with a strong first week.",
      metric: String(i.newAdmissionsThisMonth),
      metricLabel: "New students",
      icon: Sparkles,
      cta: { label: "View students", to: "/students" },
      progress: Math.min(100, 40 + i.newAdmissionsThisMonth * 8),
      progressHint: `Last month: ${i.prevAdmissions}`,
    };
  }

  // Priority 7 — Money due this week (gentle nudge)
  if (i.duesWeekAmount > 0) {
    return {
      tone: "info",
      eyebrow: "Coming up",
      title: `${formatINR(i.duesWeekAmount)} due in the next 7 days`,
      subtitle: "A quick reminder this week prevents next week's overdue list.",
      metric: formatINR(i.duesWeekAmount),
      metricLabel: "Due this week",
      icon: Wallet,
      cta: { label: "Plan reminders", to: "/fees" },
      progress: 60,
      progressHint: "Stay ahead of dues",
    };
  }

  // Fallback — all clear / today snapshot
  return {
    tone: "celebrate",
    eyebrow: "All clear",
    title:
      i.classesToday > 0
        ? `${i.classesToday} ${i.classesToday === 1 ? "class" : "classes"} today, no dues outstanding`
        : "No dues outstanding and a calm day ahead",
    subtitle:
      "Nothing on fire. Use the breathing room to plan next month's batches.",
    metric: String(i.totalStudents),
    metricLabel: "Active students",
    icon: PartyPopper,
    cta: { label: "Plan ahead", to: "/analytics" },
    progress: 100,
    progressHint: "Everything on track",
  };
}

export function DashboardSpotlight(props: SpotlightInput) {
  const s = useMemo(() => pickSpotlight(props), [props]);
  const styles = toneStyles[s.tone];
  const { reducedMotion } = usePrefers();
  const transition = reducedMotion ? fadeOnly : springDefault;

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className="mb-6"
    >
      <Card
        className={cn(
          "card-premium relative overflow-hidden border-2",
          styles.ring,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 h-[3px] origin-left bg-gradient-to-r animate-draw-bar",
            styles.bar,
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl opacity-70 bg-gradient-to-br to-transparent",
            styles.glow,
          )}
        />
        <div className="relative grid gap-5 p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em]",
                  styles.chip,
                )}
              >
                {s.eyebrow}
              </span>
            </div>
            <h2 className="mt-3 font-display text-xl sm:text-2xl font-bold leading-tight tracking-tight">
              {s.title}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-prose">
              {s.subtitle}
            </p>

            <div className="mt-4 flex items-center gap-3">
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <motion.span
                  initial={
                    reducedMotion ? { width: `${s.progress}%` } : { width: 0 }
                  }
                  animate={{ width: `${s.progress}%` }}
                  transition={transition}
                  className={cn(
                    "absolute inset-y-0 left-0 bg-gradient-to-r",
                    styles.bar,
                  )}
                />
              </div>
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground tabular-nums">
                {s.progressHint}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 md:flex-col md:items-end md:gap-3">
            <div className="text-right">
              <div className="font-display text-2xl sm:text-3xl font-bold leading-none tracking-tight tabular-nums">
                {s.metric}
              </div>
              <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {s.metricLabel}
              </div>
            </div>
            <Button asChild size="sm" className="gap-1.5">
              <Link to={s.cta.to}>
                {s.cta.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
