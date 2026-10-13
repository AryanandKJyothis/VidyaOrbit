import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: 72, logo: 36 },
  md: { box: 96, logo: 52 },
} as const;

/**
 * Compact Vidya Orbit mark with a CSS orbit in brand colours.
 * Use inside pages, overlays, or wrap with {@link LoadingScreen} for a full page.
 */
export function BrandLoader({
  label = "Loading…",
  size = "md",
  className,
}: {
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const { box, logo } = SIZES[size];
  const dot = size === "sm" ? "size-1.5" : "size-2";
  const accent = size === "sm" ? "size-1" : "size-1.5";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="relative" style={{ width: box, height: box }}>
        <div className="brand-loader-breathe absolute inset-0 rounded-full border border-dashed border-brand-teal/35" />
        <div className="brand-loader-orbit absolute inset-0" aria-hidden="true">
          <span
            className={cn(
              "absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-teal",
              dot,
            )}
          />
          <span
            className={cn(
              "absolute right-0 bottom-[18%] translate-x-1/2 rounded-full bg-brand-saffron",
              accent,
            )}
          />
          <span
            className={cn(
              "absolute bottom-[18%] left-0 -translate-x-1/2 rounded-full bg-brand-coral",
              accent,
            )}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Logo size={logo} />
        </div>
      </div>
      <p className="text-center text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="bg-brand-grid flex min-h-screen flex-col items-center justify-center px-4">
      <BrandLoader label={label} />
    </div>
  );
}

/** Covers a relative parent (setup modal) while a step saves. Form stays mounted. */
export function BrandLoaderOverlay({ label = "Saving…" }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-card/80 backdrop-blur-[6px] contrast-more:bg-card/95 contrast-more:backdrop-blur-none">
      <BrandLoader label={label} size="sm" />
    </div>
  );
}

/** Inline 3-dot bouncer for buttons / inline contexts. */
export function DotsLoader({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      aria-label="Loading"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft motion-reduce:animate-none [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft motion-reduce:animate-none [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft motion-reduce:animate-none" />
    </span>
  );
}
