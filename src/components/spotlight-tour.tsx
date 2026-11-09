import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, ArrowRight } from "lucide-react";
import { TOUR_STEPS, type TourStepId } from "@/lib/owner-onboarding";
import { cn } from "@/lib/utils";

interface SpotlightTourProps {
  stepIndex: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function SpotlightTour({
  stepIndex,
  onNext,
  onBack,
  onSkip,
  onComplete,
}: SpotlightTourProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const clamped = Math.min(Math.max(stepIndex, 0), TOUR_STEPS.length - 1);
  const step = TOUR_STEPS[clamped]!;
  const progress = ((clamped + 1) / TOUR_STEPS.length) * 100;
  const isLast = clamped === TOUR_STEPS.length - 1;

  useEffect(() => {
    const findTarget = () => {
      const target = document.querySelector(step.target);
      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect(rect);
        setIsVisible(true);
      } else {
        setTargetRect(null);
        setIsVisible(false);
      }
    };

    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    window.addEventListener("resize", findTarget);
    window.addEventListener("scroll", findTarget, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", findTarget);
      window.removeEventListener("scroll", findTarget, true);
    };
  }, [step.target]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onSkip]);

  if (!isVisible || !targetRect) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
          <p className="text-sm text-muted-foreground">
            Navigate to {step.to} to continue the tour
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={onSkip} variant="ghost" className="flex-1">
              Skip tour
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const padding = 8;
  const highlightStyle = {
    top: targetRect.top - padding,
    left: targetRect.left - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
  };

  const tooltipTop = targetRect.bottom + 16;
  const spaceBelow = window.innerHeight - targetRect.bottom;
  const placeAbove = spaceBelow < 300;

  return (
    <>
      {/* Backdrop with spotlight cutout effect */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        <div className="absolute inset-0 bg-foreground/60 backdrop-blur-sm" />
        <div
          className="absolute rounded-lg border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] pointer-events-auto"
          style={highlightStyle}
        />
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 w-full max-w-sm animate-in fade-in zoom-in-95"
        style={{
          top: placeAbove ? targetRect.top - 16 : tooltipTop,
          left: Math.max(16, Math.min(window.innerWidth - 400, targetRect.left)),
          transform: placeAbove ? "translateY(-100%)" : undefined,
        }}
      >
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">
                Step {clamped + 1} of {TOUR_STEPS.length}
              </p>
              <h3 className="mt-1 font-display text-lg font-bold leading-tight">
                {step.title}
              </h3>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onSkip}
              className="shrink-0"
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Progress className="mt-3" value={progress} />

          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {step.body}
          </p>

          <div className="mt-4 flex gap-2">
            {clamped > 0 && (
              <Button onClick={onBack} variant="outline" size="sm">
                Back
              </Button>
            )}
            <Button
              onClick={isLast ? onComplete : onNext}
              className="flex-1"
              size="sm"
            >
              {isLast ? "Done" : "Next"}
              {!isLast && <ArrowRight className="ml-1.5 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
