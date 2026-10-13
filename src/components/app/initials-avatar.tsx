import { personInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONES = [
  "bg-primary/12 text-primary",
  "bg-brand-teal/15 text-accent-foreground",
  "bg-brand-saffron/18 text-warning-foreground",
  "bg-brand-coral/14 text-destructive",
  "bg-primary-soft text-primary",
] as const;

function toneFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

export function InitialsAvatar({
  name,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const label = (name ?? "").trim() || "Student";
  const dim =
    size === "sm"
      ? "h-8 w-8 text-[10px]"
      : size === "lg"
        ? "h-12 w-12 text-sm"
        : "h-10 w-10 text-xs";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold tracking-tight",
        dim,
        toneFor(label),
        className,
      )}
    >
      {personInitials(label)}
    </span>
  );
}
