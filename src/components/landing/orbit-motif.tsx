import { cn } from "@/lib/utils";

/**
 * Supporting orbital rings from the brand mark: ink ellipse, orange
 * satellite. A fainter second plane keeps the motif graphic without
 * copying the blue planet (that stays in the logo).
 */
export function OrbitMotif({
  className,
  inverted = false,
  spin = false,
}: {
  className?: string;
  inverted?: boolean;
  spin?: boolean;
}) {
  const ring = inverted ? "#F8F7F2" : "#111111";
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      className={cn(
        "pointer-events-none",
        spin && "animate-orbit-spin",
        className,
      )}
    >
      <ellipse
        cx="100"
        cy="100"
        rx="88"
        ry="34"
        fill="none"
        stroke={ring}
        strokeWidth="6"
        transform="rotate(-28 100 100)"
        opacity="0.55"
      />
      <ellipse
        cx="100"
        cy="100"
        rx="72"
        ry="22"
        fill="none"
        stroke={ring}
        strokeWidth="1.5"
        strokeDasharray="5 11"
        transform="rotate(38 100 100)"
        opacity="0.35"
      />
      <circle
        cx="164"
        cy="58"
        r="11"
        fill="#F05A28"
        stroke={inverted ? "#1746E8" : "#F8F7F2"}
        strokeWidth="4"
      />
    </svg>
  );
}
