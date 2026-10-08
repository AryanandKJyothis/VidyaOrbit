import { cn } from "@/lib/utils";
import logoMark from "@/assets/logo-mark.webp";

type LogoProps = {
  className?: string;
  size?: number;
  /** Subtle idle float animation */
  animated?: boolean;
};

/**
 * Vidya logo mark — uses the brand image directly.
 */
export function Logo({ className, size = 32, animated = false }: LogoProps) {
  return (
    <img
      src={logoMark}
      alt="Vidya"
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
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo size={size} />
      <div className="flex flex-col leading-tight">
        <span
          className={cn(
            "font-display text-base font-bold tracking-tight",
            inverted ? "text-sidebar-foreground" : "text-foreground",
          )}
        >
          Vidya
        </span>
        <span
          className={cn(
            "text-[10.5px] uppercase tracking-[0.16em] font-semibold",
            inverted ? "text-sidebar-foreground/65" : "text-muted-foreground",
          )}
        >
          Orbit
        </span>
      </div>
    </div>
  );
}
