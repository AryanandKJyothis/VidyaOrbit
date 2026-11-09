import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SpotlightStep {
  /** Unique ID for this step */
  id: string;
  /** CSS selector for the target element */
  target: string;
  /** Title shown in the tooltip */
  title: string;
  /** Description/instruction */
  content: string;
  /** Optional: only show if this condition is true */
  condition?: () => boolean;
  /** Tooltip position preference */
  placement?: "top" | "bottom" | "left" | "right" | "auto";
}

interface SpotlightTourProps {
  steps: SpotlightStep[];
  onComplete: () => void;
  onSkip: () => void;
}

export function SpotlightTour({
  steps,
  onComplete,
  onSkip,
}: SpotlightTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Filter steps based on conditions and available targets
  const availableSteps = steps.filter((step) => {
    if (step.condition && !step.condition()) return false;
    const target = document.querySelector(step.target);
    return target !== null;
  });

  const currentStep = availableSteps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === availableSteps.length - 1;

  // Calculate target position and tooltip placement
  const updatePositions = () => {
    if (!currentStep) return;

    const target = document.querySelector(currentStep.target) as HTMLElement;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    setTargetRect(rect);

    // Calculate tooltip position
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 16;
    const placement = currentStep.placement || "auto";

    let x = 0;
    let y = 0;

    if (placement === "auto" || placement === "bottom") {
      // Try bottom first
      x = rect.left + rect.width / 2 - tooltipRect.width / 2;
      y = rect.bottom + padding;

      // If doesn't fit at bottom, try top
      if (y + tooltipRect.height > window.innerHeight - padding) {
        y = rect.top - tooltipRect.height - padding;
      }
    } else if (placement === "top") {
      x = rect.left + rect.width / 2 - tooltipRect.width / 2;
      y = rect.top - tooltipRect.height - padding;
    } else if (placement === "left") {
      x = rect.left - tooltipRect.width - padding;
      y = rect.top + rect.height / 2 - tooltipRect.height / 2;
    } else if (placement === "right") {
      x = rect.right + padding;
      y = rect.top + rect.height / 2 - tooltipRect.height / 2;
    }

    // Keep tooltip within viewport
    x = Math.max(
      padding,
      Math.min(x, window.innerWidth - tooltipRect.width - padding),
    );
    y = Math.max(
      padding,
      Math.min(y, window.innerHeight - tooltipRect.height - padding),
    );

    setTooltipPosition({ x, y });
  };

  // Scroll target into view if needed
  const scrollToTarget = () => {
    if (!currentStep) return;
    const target = document.querySelector(currentStep.target) as HTMLElement;
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    updatePositions();
    scrollToTarget();

    const handleResize = () => updatePositions();
    const handleScroll = () => updatePositions();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [currentStep]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onSkip();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onSkip]);

  // Focus management - focus the tooltip when it appears
  useEffect(() => {
    if (tooltipRef.current) {
      tooltipRef.current.focus();
    }
  }, [currentStepIndex]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex((i) => i + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStepIndex((i) => i - 1);
    }
  };

  if (!currentStep || availableSteps.length === 0) {
    onComplete();
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999]" ref={overlayRef}>
      {/* Dimmed overlay with cutout */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      >
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 4}
                y={targetRect.top - 4}
                width={targetRect.width + 8}
                height={targetRect.height + 8}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Highlight ring around target */}
      {targetRect && (
        <div
          className="absolute pointer-events-none rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-transparent"
          style={{
            left: targetRect.left - 4,
            top: targetRect.top - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute bg-card rounded-xl shadow-[var(--shadow-elevated)] border border-border p-5 max-w-sm"
        style={{
          left: tooltipPosition.x,
          top: tooltipPosition.y,
        }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="spotlight-title"
        aria-describedby="spotlight-content"
      >
        <button
          onClick={onSkip}
          className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Skip tour"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-1 flex items-center gap-2">
          <h3
            id="spotlight-title"
            className="font-semibold text-foreground pr-6"
          >
            {currentStep.title}
          </h3>
        </div>

        <p
          id="spotlight-content"
          className="text-sm text-muted-foreground leading-relaxed mt-2"
        >
          {currentStep.content}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {availableSteps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === currentStepIndex
                    ? "bg-primary"
                    : "bg-muted-foreground/30",
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="h-9"
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Back
              </Button>
            )}
            <Button onClick={handleNext} size="sm" className="h-9">
              {isLastStep ? "Done" : "Next"}
              {!isLastStep && <ArrowRight className="ml-1 h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
