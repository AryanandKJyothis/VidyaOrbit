import { Link } from "@tanstack/react-router";
import { Lock, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useSubscription,
  hasMinPlan,
  type PlanCode,
  PLANS,
} from "@/hooks/use-subscription";
import {
  getContactMessage,
  getContactLink,
  getContactLabel,
  hasAnyContact,
} from "@/lib/contact-config";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";

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
  const { active } = useActiveWorkspace();
  if (sub.isLoading) return null;
  if (hasMinPlan(sub.data?.plan, min)) return <>{children}</>;

  const planName = PLANS.find((p) => p.code === min)?.name ?? min;
  const isOwner = active?.role === "owner";
  const contactMsg = getContactMessage(isOwner);
  const contactUrl = getContactLink();
  const contactLabel = getContactLabel();
  const showContact = hasAnyContact();

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
            {contactMsg || `This feature requires the ${planName} plan.`}
          </p>
        </div>
        <div className="flex gap-2">
          {!showContact && (
            <Button asChild>
              <Link to="/plan">View Plans</Link>
            </Button>
          )}
          {showContact && contactUrl && (
            <Button asChild variant={showContact ? "default" : "outline"}>
              <a href={contactUrl} target="_blank" rel="noopener noreferrer">
                {contactLabel} <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
