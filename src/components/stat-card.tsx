import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { motion, useInView } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { usePrefers } from "@/hooks/use-prefers";
import { fadeOnly, springDefault } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { countUpFrame, parseCountUpTarget } from "@/lib/count-up";

type Props = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive";
  index?: number;
  /** Optional sparkline series — small numeric trend (last N points). */
  sparkline?: number[];
  /** Optional delta vs previous period in percent, e.g. +12 or -8. */
  deltaPct?: number;
  /** Animate the number counting up. Off for money totals that must never show interim values. */
  countUp?: boolean;
};

const toneIcon: Record<string, string> = {
  default: "bg-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  destructive: "bg-destructive text-destructive-foreground",
};

const toneBar: Record<string, string> = {
  default: "from-primary via-brand-teal to-brand-teal",
  success: "from-success via-brand-teal to-brand-teal",
  warning: "from-brand-saffron via-brand-sun to-brand-saffron",
  destructive: "from-brand-coral via-destructive to-brand-coral",
};

const toneSpark: Record<string, string> = {
  default: "stroke-[#1746E8]",
  success: "stroke-[oklch(0.62_0.15_160)]",
  warning: "stroke-[oklch(0.70_0.15_60)]",
  destructive: "stroke-[oklch(0.62_0.20_28)]",
};

function Sparkline({
  data,
  className,
}: {
  data: number[];
  className?: string;
}) {
  if (data.length < 2) return null;
  const w = 80;
  const h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <polyline
        fill="none"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

const COUNT_UP_MS = 700;

function useCountUp(target: string, enabled: boolean): string {
  const [display, setDisplay] = useState(target);
  useEffect(() => {
    // Hidden tabs throttle rAF; never animate there or we could strand an
    // interim number on screen.
    const hidden = typeof document !== "undefined" && document.hidden;
    if (!enabled || hidden || !parseCountUpTarget(target)) {
      setDisplay(target);
      return;
    }
    const startTs = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTs) / COUNT_UP_MS);
      setDisplay(countUpFrame(target, t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Safety net: land on the exact value even if frames stop firing.
    const settle = window.setTimeout(() => {
      cancelAnimationFrame(raf);
      setDisplay(target);
    }, COUNT_UP_MS + 100);
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        setDisplay(target);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [target, enabled]);
  return display;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  index = 0,
  sparkline,
  deltaPct,
  countUp = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const { reducedMotion } = usePrefers();
  const displayValue = useCountUp(value, countUp && inView && !reducedMotion);
  const deltaUp = (deltaPct ?? 0) >= 0;

  return (
    <motion.div
      ref={ref}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{
        ...(reducedMotion ? fadeOnly : springDefault),
        delay: reducedMotion ? 0 : index * 0.04,
      }}
      className="group h-full"
    >
      <Card className="card-premium relative overflow-hidden h-full">
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 h-[3px] origin-left bg-gradient-to-r animate-draw-bar",
            toneBar[tone],
          )}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-brand-teal/15 to-transparent opacity-0 transition-opacity duration-200 [transition-timing-function:var(--ease-out)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-70"
        />
        <CardContent className="relative p-4 sm:p-5 flex flex-col justify-between h-full gap-3">
          <div className="flex items-start justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="type-kicker text-muted-foreground">{label}</div>
              <div
                className="mt-2 sm:mt-3 font-display text-2xl sm:text-[1.75rem] font-bold leading-none tracking-tight tabular-nums break-words"
                aria-label={value}
              >
                {displayValue}
              </div>
            </div>
            <div
              className={cn(
                "flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl shadow-sm",
                toneIcon[tone],
              )}
            >
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col gap-1 min-w-0">
              {typeof deltaPct === "number" && (
                <span
                  className={cn(
                    "pill",
                    deltaUp ? "pill-success" : "pill-danger",
                  )}
                >
                  {deltaUp ? (
                    <ArrowUpRight className="h-3 w-3" aria-hidden />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" aria-hidden />
                  )}
                  {Math.abs(deltaPct).toFixed(0)}%
                </span>
              )}
              {hint && (
                <div className="text-xs text-muted-foreground/80 font-medium truncate">
                  {hint}
                </div>
              )}
            </div>
            {sparkline && sparkline.length > 1 && (
              <Sparkline data={sparkline} className={toneSpark[tone]} />
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
