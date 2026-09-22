import { createFileRoute, Link } from "@tanstack/react-router";
import { format, differenceInCalendarDays } from "date-fns";
import { CreditCard, Calendar, Users, AlertTriangle, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription, PLANS } from "@/hooks/use-subscription";
import { useStudents } from "@/hooks/use-data";
import { OverLimitBanner } from "@/components/over-limit-banner";
import { ExpiryBanner } from "@/components/expiry-banner";

export const Route = createFileRoute("/_authenticated/plan")({
  component: PlanPage,
});

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "trial":
    case "trialing":
    case "pending_checkout":
      return "secondary";
    case "expired":
    case "suspended":
    case "canceled":
    case "past_due":
      return "destructive";
    default:
      return "outline";
  }
}


function PlanPage() {
  const sub = useSubscription();
  const students = useStudents();

  if (sub.isLoading || !sub.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const data = sub.data;
  const meta = PLANS.find((p) => p.code === data.plan) ?? PLANS[0];
  const used = students.data?.length ?? 0;
  const limit = Number.isFinite(data.limit) ? data.limit : 9999;
  const usagePct = Math.min(100, Math.round((used / limit) * 100));
  const expiry = data.expiry_date ? new Date(data.expiry_date) : null;
  const daysLeft = expiry ? differenceInCalendarDays(expiry, new Date()) : null;
  const expired = data.expired;
  const price = data.plan_price;

  return (
    <div className="space-y-6">
      <PageHeader title="Plan & Subscription" description="Your current plan, status, and usage." />

      {!data.isOwner && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 text-sm text-muted-foreground">
            You're viewing the institute owner's plan. Only the owner can change billing.
          </CardContent>
        </Card>
      )}

      <ExpiryBanner />
      <OverLimitBanner />

      {expired && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">Your subscription has expired.</p>
              <p className="text-muted-foreground">
                Premium features and higher student limits are temporarily disabled. Your existing
                data is safe — contact your administrator to renew.
              </p>
            </div>
          </CardContent>
        </Card>
      )}



      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CreditCard className="h-5 w-5" />
                {meta.name} Plan
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{meta.tagline}</p>
            </div>
            <Badge variant={statusVariant(data.status)} className="capitalize">
              {data.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Plan price"
              value={price != null ? `₹${Number(price).toLocaleString("en-IN")}` : "—"}
            />
            <Stat
              label="Start date"
              value={data.start_date ? format(new Date(data.start_date), "d MMM yyyy") : "—"}
            />
            <Stat
              label="Expiry date"
              value={expiry ? format(expiry, "d MMM yyyy") : "—"}
            />
            <Stat
              label="Days remaining"
              value={
                daysLeft == null
                  ? "—"
                  : daysLeft < 0
                    ? "Expired"
                    : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`
              }
              tone={daysLeft != null && daysLeft <= 7 ? "warning" : undefined}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Students
              </span>
              <span className="font-medium">
                {used} / {limit}
              </span>
            </div>
            <Progress value={usagePct} />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Included features
            </p>
            <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
              {meta.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {data.notes && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes from your administrator
              </p>
              <p className="whitespace-pre-wrap text-foreground">{data.notes}</p>
            </div>
          )}

          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            <Calendar className="mr-2 inline h-4 w-4" />
            To change your plan, extend your subscription, or update billing details, please
            contact your administrator.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={
          "mt-1 text-sm font-semibold " +
          (tone === "warning" ? "text-destructive" : "text-foreground")
        }
      >
        {value}
      </p>
    </div>
  );
}
