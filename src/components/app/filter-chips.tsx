import { cn } from "@/lib/utils";

export type FilterChip = {
  id: string;
  label: string;
  count?: number;
  tone?: "default" | "danger" | "warning";
};

export function FilterChips({
  chips,
  value,
  onChange,
  ariaLabel,
}: {
  chips: FilterChip[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => {
        const active = chip.id === value;
        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(chip.id)}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-[transform,background-color,border-color,color] duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.97] motion-reduce:active:scale-100",
              active
                ? chip.tone === "danger"
                  ? "border-destructive/30 bg-destructive text-destructive-foreground"
                  : chip.tone === "warning"
                    ? "border-warning/30 bg-warning text-warning-foreground"
                    : "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted/60",
            )}
          >
            {chip.label}
            {typeof chip.count === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[11px] tabular-nums",
                  active ? "bg-white/20" : "bg-muted text-muted-foreground",
                )}
              >
                {chip.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
