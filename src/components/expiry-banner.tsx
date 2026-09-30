import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/use-subscription";
import { BILLING_DISABLED } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Shows a dismissible expiry warning when the subscription is within 7 days
 * of expiring, with severity ramping as the date approaches. Dismissal is
 * stored per-day in localStorage so the warning reappears the next day —
 * a permanent silence isn't possible by design.
 */
export function ExpiryBanner() {
  const sub = useSubscription();
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem("vidya:expiry-dismissed"));
  }, []);

  if (!sub.data) return null;
  const { plan, expiry_date, expired, days_until_expiry } = sub.data;

  // Nothing to remind for free plans or open-ended subscriptions
  if (plan === "free" && !expired) return null;
  if (!expiry_date) return null;
  if (days_until_expiry === null) return null;
  if (!expired && days_until_expiry > 7) return null;

  const dayKey = `${todayKey()}:${expiry_date}`;
  if (dismissed === dayKey) return null;

  const severity: "warning" | "danger" =
    expired || days_until_expiry <= 3 ? "danger" : "warning";

  const message = expired
    ? `Your subscription expired ${Math.abs(days_until_expiry)} day${Math.abs(days_until_expiry) === 1 ? "" : "s"} ago. You've been moved to the Free plan — your data is safe, but premium limits now apply.`
    : days_until_expiry === 0
      ? "Your subscription expires today."
      : `Your subscription expires in ${days_until_expiry} day${days_until_expiry === 1 ? "" : "s"}.`;

  return (
    <Card
      className={cn(
        "mb-4",
        severity === "danger" && "border-destructive/40 bg-destructive/5",
        severity === "warning" && "border-amber-500/40 bg-amber-500/5",
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {severity === "danger" ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          ) : (
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div className="space-y-1">
            <p className="text-sm font-semibold">{message}</p>
            <p className="text-xs text-muted-foreground">
              {expired
                ? "Renew to restore your previous plan limits and features."
                : "Renew before then to avoid being moved to the Free plan."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            asChild
            size="sm"
            variant={severity === "danger" ? "default" : "outline"}
          >
            <Link to={BILLING_DISABLED ? "/plan" : "/billing"}>
              {expired ? "Renew now" : "Renew"}
            </Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              window.localStorage.setItem("vidya:expiry-dismissed", dayKey);
              setDismissed(dayKey);
            }}
            aria-label="Dismiss for today"
            className="h-9 w-9"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
