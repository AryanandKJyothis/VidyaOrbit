import { LucideIcon, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ERROR_ARIA_LIVE, LOADING_ARIA_LIVE } from "@/lib/accessibility";

type Props = {
  icon?: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
};

/**
 * Comprehensive state container for query results.
 * Renders loading skeleton, error state, or empty state based on query status.
 */
export function QueryStateContainer({
  isLoading,
  isError,
  error,
  isEmpty,
  onRetry,
  loadingFallback = <QueryLoadingSkeleton />,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isEmpty: boolean;
  onRetry?: () => void;
  loadingFallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  if (isError && error) {
    return <QueryErrorState error={error} onRetry={onRetry} />;
  }

  if (isEmpty) {
    return (
      <QueryEmptyState
        title="No data"
        description="There's nothing to display here yet."
      />
    );
  }

  return <>{children}</>;
}

/**
 * Loading state with skeleton animation.
 */
export function QueryLoadingSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} {...LOADING_ARIA_LIVE}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-md bg-muted animate-pulse"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

/**
 * Error state with retry button.
 */
export function QueryErrorState({
  error,
  onRetry,
  title = "Failed to load data",
}: {
  error: Error;
  onRetry?: () => void;
  title?: string;
}) {
  const message =
    error?.message || "An unexpected error occurred. Please try again.";

  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center"
      role="alert"
      aria-label={title}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <Button
          size="sm"
          onClick={onRetry}
          className="mt-4"
          variant="outline"
          aria-label="Retry loading data"
        >
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Empty state when no data exists.
 */
export function QueryEmptyState({
  icon: Icon,
  title = "No data",
  description = "There's nothing to display here yet.",
  children,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/80 text-muted-foreground">
          <Icon className="h-6 w-6" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
      {children && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Loading button state indicator.
 */
export function LoadingButton({
  isLoading,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { isLoading?: boolean }) {
  return (
    <Button {...props} disabled={isLoading || props.disabled}>
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
