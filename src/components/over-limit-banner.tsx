import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription, PLANS } from "@/hooks/use-subscription";
import { formatStudentLimit } from "@/lib/plan-limits";

/**
 * Banner shown when an institute's student count exceeds the plan limit
 * (i.e. they downgraded or their subscription expired). Existing data is
 * NEVER deleted by downgrade — this banner explains that adding new
 * students is paused until they upgrade.
 */
export function OverLimitBanner() {
  const sub = useSubscription();
  if (!sub.data || !sub.data.over_limit) return null;

  const planMeta = PLANS.find((p) => p.code === sub.data!.plan);
  const planName = planMeta?.name ?? "Free";

  return (
    <Card className="mb-4 border-destructive/40 bg-destructive/5">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              You have {sub.data.student_count} students on the {planName} plan
              (limit {formatStudentLimit(sub.data.limit)}).
            </p>
            <p className="text-xs text-muted-foreground">
              Your data is safe and usable — adding new students is paused until
              you upgrade.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild size="sm">
            <Link to="/plan">View &amp; Upgrade</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
