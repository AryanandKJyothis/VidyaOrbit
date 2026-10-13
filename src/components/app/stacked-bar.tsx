import { cn } from "@/lib/utils";

export function StackedBar({
  segments,
  className,
}: {
  segments: { key: string; value: number; className: string; label: string }[];
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div
      className={cn(
        "flex h-3 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      role="img"
      aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
    >
      {total === 0 ? (
        <div className="h-full w-full bg-muted" />
      ) : (
        segments.map((s) =>
          s.value <= 0 ? null : (
            <div
              key={s.key}
              className={cn("h-full min-w-0", s.className)}
              style={{ width: `${(s.value / total) * 100}%` }}
              title={`${s.label}: ${s.value}`}
            />
          ),
        )
      )}
    </div>
  );
}
