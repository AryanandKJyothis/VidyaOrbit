import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RenewalBanner } from "@/components/renewal-banner";
import { RazorpayCheckout } from "@/components/razorpay-checkout";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { Check, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";

type BillingCycle = "monthly" | "annual";
type PlanTier = "starter" | "growth" | "large";

type TierConfig = {
  tier: PlanTier;
  name: string;
  description: string;
  studentLimit: number;
  monthlyPricePaise: number;
  annualPricePaise: number;
  setupFeePaise: number;
  features: string[];
};

type PricingData = {
  tiers: TierConfig[];
  cycles: Array<{ cycle: BillingCycle; label: string }>;
};

export const Route = createFileRoute("/_authenticated/plan")({
  component: PlanPage,
});

function PlanPage() {
  const { user } = useAuth();
  const subQuery = useSubscription();
  const [cycle, setCycle] = useState<BillingCycle>("annual");
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [hasPaidSetup, setHasPaidSetup] = useState(false);

  const subscription = subQuery.data;
  const isOwner = subscription?.isOwner ?? false;

  // Fetch pricing data (simplified - hasPaidSetup check would be added later)
  useEffect(() => {
    fetch("/api/billing/pricing")
      .then((res) => res.json())
      .then((data) => {
        setPricing(data);
        setBillingEnabled(data.billingEnabled ?? false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  const currentPlan = subscription?.plan ?? "starter";
  const expiryDate = subscription?.expiry_date
    ? new Date(subscription.expiry_date)
    : null;
  const isExpired = subscription?.expired ?? false;
  const daysLeft = subscription?.days_until_expiry ?? null;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Plan &amp; Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and billing preferences
        </p>
      </div>

      {/* Renewal banner */}
      {expiryDate && isOwner && (
        <RenewalBanner
          expiryDate={expiryDate}
          isOwner={isOwner}
          isExpired={isExpired}
        />
      )}

      {/* Current plan status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your subscription details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Plan</span>
            <Badge variant="default" className="capitalize">
              {currentPlan}
            </Badge>
          </div>
          {expiryDate && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Expires</span>
                <span className="text-sm">{format(expiryDate, "PPP")}</span>
              </div>
              {daysLeft !== null && !isExpired && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Days remaining</span>
                  <span className="text-sm font-semibold">{daysLeft}</span>
                </div>
              )}
            </>
          )}
          {subscription && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Students</span>
              <span className="text-sm">
                {subscription.student_count} /{" "}
                {subscription.limit === Infinity ||
                subscription.limit === 2147483647
                  ? "Unlimited"
                  : subscription.limit}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-lg border p-1">
          <Button
            variant={cycle === "monthly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setCycle("monthly")}
          >
            Monthly
          </Button>
          <Button
            variant={cycle === "annual" ? "default" : "ghost"}
            size="sm"
            onClick={() => setCycle("annual")}
          >
            Annual
            <Badge variant="secondary" className="ml-2">
              Save
            </Badge>
          </Button>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {pricing?.tiers.map((tier) => (
          <PricingCard
            key={tier.tier}
            tier={tier}
            cycle={cycle}
            currentPlan={currentPlan}
            isOwner={isOwner}
            billingEnabled={billingEnabled}
            hasPaidSetup={hasPaidSetup}
            onSuccess={() => subQuery.refetch()}
          />
        ))}
      </div>

      {/* GST notice */}
      <Alert className="max-w-2xl mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> GST calculations and invoicing are not yet
          implemented. Prices shown are before tax.
        </AlertDescription>
      </Alert>
    </div>
  );
}

type PricingCardProps = {
  tier: TierConfig;
  cycle: BillingCycle;
  currentPlan: string;
  isOwner: boolean;
  billingEnabled: boolean;
  hasPaidSetup: boolean;
  onSuccess: () => void;
};

function PricingCard({
  tier,
  cycle,
  currentPlan,
  isOwner,
  billingEnabled,
  hasPaidSetup,
  onSuccess,
}: PricingCardProps) {
  const price =
    cycle === "monthly" ? tier.monthlyPricePaise : tier.annualPricePaise;
  const displayPrice = Math.floor(price / 100);

  // Setup fee applies only on monthly for Growth/Large, and only if not yet paid
  const setupApplies =
    cycle === "monthly" && tier.setupFeePaise > 0 && !hasPaidSetup;
  const setupFee = setupApplies ? tier.setupFeePaise / 100 : 0;
  const firstPaymentTotal = displayPrice + setupFee;

  // Calculate savings for annual
  const monthlyCost = tier.monthlyPricePaise * 12;
  const setupSavings = tier.setupFeePaise > 0 ? tier.setupFeePaise / 100 : 0;
  const annualCost = tier.annualPricePaise;
  const priceSavings =
    cycle === "annual" ? Math.floor((monthlyCost - annualCost) / 100) : 0;

  const isCurrent = tier.tier === currentPlan;

  return (
    <Card className={isCurrent ? "border-primary shadow-lg" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {tier.name}
          {isCurrent && (
            <Badge variant="default" className="ml-2">
              Current
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{tier.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pricing */}
        <div>
          <div className="text-3xl font-bold">
            ₹{displayPrice.toLocaleString("en-IN")}
          </div>
          <div className="text-sm text-muted-foreground">
            per {cycle === "monthly" ? "month" : "year"}
          </div>

          {cycle === "annual" && priceSavings > 0 && (
            <div className="text-sm font-medium text-green-600 mt-1">
              Save ₹{priceSavings.toLocaleString("en-IN")}
              {setupSavings > 0 && tier.tier !== "starter" && (
                <span>
                  {" "}
                  + free ₹{setupSavings.toLocaleString("en-IN")} setup
                </span>
              )}
            </div>
          )}

          {cycle === "monthly" && setupFee > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-sm text-muted-foreground">
                + ₹{setupFee.toLocaleString("en-IN")} one-time setup
              </div>
              <div className="text-sm font-medium">
                First payment: ₹{firstPaymentTotal.toLocaleString("en-IN")}
              </div>
            </div>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span>
              {tier.studentLimit === 2147483647
                ? "Unlimited students"
                : `Up to ${tier.studentLimit} students`}
            </span>
          </li>
          {tier.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        {billingEnabled && isOwner ? (
          <RazorpayCheckout
            tier={tier.tier}
            cycle={cycle}
            buttonLabel={isCurrent ? "Renew Plan" : "Upgrade"}
            onSuccess={onSuccess}
          />
        ) : (
          <Button variant="outline" className="w-full" disabled={!isOwner}>
            {!isOwner ? "Owner Only" : "Contact Us"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
