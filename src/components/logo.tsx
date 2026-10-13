import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  size?: number;
  /** Subtle idle float animation */
  animated?: boolean;
};

const MARK_LABEL = "Vidya Orbit";

/**
 * Vidya Orbit mark — blue planet, ink orbit ring, orange satellite.
 * Keep the core colours; sit it on paper when the surface is dark.
 */
export function Logo({ className, size = 32, animated = false }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={MARK_LABEL}
      className={cn(
        "shrink-0 select-none",
        animated && "animate-float",
        className,
      )}
    >
      <circle cx="100" cy="100" r="58" fill="#1746E8" />
      <ellipse
        cx="100"
        cy="100"
        rx="88"
        ry="34"
        fill="none"
        stroke="#111111"
        strokeWidth="9"
        transform="rotate(-28 100 100)"
      />
      <circle
        cx="164"
        cy="58"
        r="12"
        fill="#F05A28"
        stroke="#F8F7F2"
        strokeWidth="5"
      />
    </svg>
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
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className="flex shrink-0 items-center justify-center rounded-md"
        style={{
          width: size + 4,
          height: size + 4,
          backgroundColor: "#F8F7F2",
        }}
      >
        <Logo size={size} />
      </span>
      <span
        className={cn(
          "font-display text-sm font-bold tracking-[-0.04em] sm:text-base",
          inverted ? "text-primary-foreground" : "text-foreground",
        )}
      >
        Vidya Orbit
      </span>
    </div>
  );
}
