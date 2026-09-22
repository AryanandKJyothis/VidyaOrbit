import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription, hasMinPlan, type PlanCode, PLANS } from "@/hooks/use-subscription";
import { BILLING_DISABLED } from "@/lib/feature-flags";

export function PlanGate({
  min,
  feature,
  children,
}: {
  min: PlanCode;
  feature: string;
  children: React.ReactNode;
}) {
  const sub = useSubscription();
  if (sub.isLoading) return null;
  if (hasMinPlan(sub.data?.plan, min)) return <>{children}</>;
  const planName = PLANS.find((p) => p.code === min)?.name ?? min;
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            {feature} is a {planName} feature
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {BILLING_DISABLED
              ? `Contact your administrator to unlock ${feature.toLowerCase()}.`
              : `Upgrade your plan to unlock ${feature.toLowerCase()} and more.`}
          </p>
        </div>
        {!BILLING_DISABLED && (
          <Button asChild>
            <Link to="/billing">
              <Sparkles className="mr-1.5 h-4 w-4" /> View plans
            </Link>
          </Button>
        )}
        {BILLING_DISABLED && (
          <Button asChild variant="outline">
            <Link to="/plan">View your plan</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
