import { Logo } from "@/components/logo";

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="bg-brand-grid flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="absolute inset-0 -m-3 rounded-full bg-primary/5 animate-pulse-soft" />
        <Logo size={56} />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-teal opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-teal" />
        </span>
        {label}
      </div>
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
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft" />
    </span>
  );
}
