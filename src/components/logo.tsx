import { cn } from "@/lib/utils";

/** Exact files from the Vidya Orbit brand kit (`brand/` / `public/brand/`). */
export const LOGO_MARK_SRC = "/brand/vidya-orbit-mark.svg";
export const LOGO_LOCKUP_SRC = "/brand/vidya-orbit-logo.svg";

const LOCKUP_ASPECT = 780 / 180;
const PAPER = "#F8F7F2";

type LogoProps = {
  className?: string;
  size?: number;
  /** Subtle idle float animation */
  animated?: boolean;
};

/**
 * Standalone mark from vidya-orbit-mark.svg.
 * Sit it on paper when the surface is dark so the ink ring stays visible
 * without recoloring the blue core or orange satellite.
 */
export function Logo({ className, size = 32, animated = false }: LogoProps) {
  return (
    <img
      src={LOGO_MARK_SRC}
      alt="Vidya Orbit"
      width={size}
      height={size}
      className={cn(
        "object-contain shrink-0 select-none",
        animated && "animate-float",
        className,
      )}
      draggable={false}
    />
  );
}

export function LogoWordmark({
  size = 32,
  className,
  inverted = false,
}: {
  size?: number;
  className?: string;
  inverted?: boolean;
}) {
  if (inverted) {
    const pad = Math.max(4, Math.round(size * 0.12));
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span
          className="flex shrink-0 items-center justify-center rounded-md"
          style={{
            width: size + pad * 2,
            height: size + pad * 2,
            backgroundColor: PAPER,
          }}
        >
          <Logo size={size} />
        </span>
        <span className="font-display text-sm font-bold tracking-[-0.05em] text-primary-foreground sm:text-base">
          VIDYA ORBIT
        </span>
      </div>
    );
  }

  const width = Math.round(size * LOCKUP_ASPECT);
  return (
    <img
      src={LOGO_LOCKUP_SRC}
      alt="Vidya Orbit"
      width={width}
      height={size}
      className={cn(
        "object-contain object-left shrink-0 select-none",
        className,
      )}
      draggable={false}
    />
  );
}
