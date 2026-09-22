import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-lg bg-gradient-to-r from-muted/40 to-muted/20", className)} {...props} />;
}

export { Skeleton };
