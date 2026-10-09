import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg bg-muted/55", className)} {...props} />;
}

export { Skeleton };
