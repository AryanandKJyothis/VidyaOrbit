import { AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminAlert } from "@/lib/admin-mrr";
import { cn } from "@/lib/utils";

export function AdminAlertsPanel({
  alerts,
  loading,
  onOpen,
}: {
  alerts: AdminAlert[];
  loading?: boolean;
  onOpen?: (href: string, ownerId: string | null) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    );
  }
  if (alerts.length === 0) {
    return (
      <EmptyState
        title="All clear"
        description="No review holds, webhook errors, over-limit centres, or orphan accounts."
      />
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-border/80">
          {alerts.map((alert, i) => (
            <li key={`${alert.kind}-${alert.owner_id}-${i}`}>
              <button
                type="button"
                onClick={() => onOpen?.(alert.href, alert.owner_id)}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 [transition-timing-function:var(--ease-out)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/40"
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    alert.severity === "danger" &&
                      "bg-destructive text-destructive-foreground",
                    alert.severity === "warning" &&
                      "bg-warning text-warning-foreground",
                    alert.severity === "info" && "bg-primary-soft text-primary",
                  )}
                >
                  {alert.severity === "info" ? (
                    <Info className="h-5 w-5" aria-hidden />
                  ) : (
                    <AlertTriangle className="h-5 w-5" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{alert.title}</p>
                    <Badge variant="outline" className="capitalize">
                      {alert.kind.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {alert.name ?? "—"}
                  </p>
                  {alert.detail && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {alert.detail}
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
