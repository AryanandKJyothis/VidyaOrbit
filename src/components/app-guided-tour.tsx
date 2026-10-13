import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { TOUR_STEPS, type TourStepId } from "@/lib/owner-onboarding";
import { usePrefers } from "@/hooks/use-prefers";
import { fadeOnly, springDefault } from "@/lib/motion";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  LayoutDashboard,
  Users,
  Wallet,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TOUR_ICONS: Record<TourStepId, LucideIcon> = {
  dashboard: LayoutDashboard,
  attendance: CalendarCheck,
  fees: Wallet,
  students: Users,
  plan: Sparkles,
};

export function AppGuidedTourView({
  stepIndex,
  onNext,
  onBack,
  onSkip,
  onGoToPage,
  className,
}: {
  stepIndex: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onGoToPage?: (to: (typeof TOUR_STEPS)[number]["to"]) => void;
  className?: string;
}) {
  const { reducedMotion } = usePrefers();
  const transition = reducedMotion ? fadeOnly : springDefault;
  const clamped = Math.min(Math.max(stepIndex, 0), TOUR_STEPS.length - 1);
  const step = TOUR_STEPS[clamped]!;
  const Icon = TOUR_ICONS[step.id];
  const last = clamped === TOUR_STEPS.length - 1;
  const progress = ((clamped + 1) / TOUR_STEPS.length) * 100;

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={transition}
      className={cn(
        "w-full max-w-md rounded-2xl border border-border/80 bg-card p-5 shadow-[var(--shadow-elevated)] sm:p-6",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-tour-title"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="type-kicker text-muted-foreground">
            Tour {clamped + 1} of {TOUR_STEPS.length}
          </p>
          <h2
            id="app-tour-title"
            className="mt-1 font-display text-xl font-bold leading-tight tracking-[-0.02em]"
          >
            {step.title}
          </h2>
        </div>
      </div>
      <Progress
        className="mt-4"
        value={progress}
        aria-label={`Tour step ${clamped + 1} of ${TOUR_STEPS.length}`}
      />
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground text-pretty">
        {step.body}
      </p>
      <div className="mt-5 flex flex-col gap-2">
        {onGoToPage && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onGoToPage(step.to)}
          >
            {step.cta}
          </Button>
        )}
        <div className="flex gap-2">
          {clamped > 0 && (
            <Button type="button" variant="ghost" onClick={onBack}>
              Back
            </Button>
          )}
          <Button type="button" className="min-w-0 flex-1" onClick={onNext}>
            {last ? "Done" : "Next"}
            {!last && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
        <button
          type="button"
          className="mx-auto min-h-11 text-xs text-muted-foreground underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
          onClick={onSkip}
        >
          Skip tour
        </button>
      </div>
    </motion.div>
  );
}

export function AppGuidedTourOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-[2px] sm:items-center">
      {children}
    </div>
  );
}
