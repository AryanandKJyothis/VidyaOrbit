import { cn } from "@/lib/utils";

/** Supporting orbital ring. Used only on the hero and final CTA. */
export function OrbitMotif({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  const ring = inverted ? "#F8F7F2" : "#111111";
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      className={cn("pointer-events-none", className)}
    >
      <ellipse
        cx="100"
        cy="100"
        rx="88"
        ry="34"
        fill="none"
        stroke={ring}
        strokeWidth="2"
        transform="rotate(-28 100 100)"
        opacity="0.35"
      />
      <circle cx="164" cy="58" r="8" fill="#F05A28" />
    </svg>
  );
}
