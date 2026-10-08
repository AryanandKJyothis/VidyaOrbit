import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, CreditCard, MessageCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { RoutePermissionGate } from "@/components/route-permission-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudents } from "@/hooks/use-data";
import {
  useSubscription,
  PLANS,
  PLAN_RANK,
  type PlanCode,
} from "@/hooks/use-subscription";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getContactConfig } from "@/lib/contact-config";

import { redirect } from "@tanstack/react-router";
import { BILLING_DISABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/_authenticated/billing")({
  beforeLoad: () => {
    // Redirect to /plan page - annual billing is now on /plan
    throw redirect({ to: "/plan" });
  },
  component: BillingPage,
});

const CHECKOUT_PENDING_STATUSES = new Set([
  "pending_checkout",
  "processing_checkout",
]);

function contactSubject(planName: string, currentPlan: string) {
  return encodeURIComponent(`Vidya plan change: ${currentPlan} → ${planName}`);
}

function contactBody(planName: string, currentPlan: string) {
  return encodeURIComponent(
    `Hi, I want to change my Vidya subscription plan from ${currentPlan} to ${planName}. Please let me know the next steps.`,
  );
}

function planWhatsappHref(
  planName: string,
  currentPlan: string,
  baseWhatsappUrl: string,
) {
  const text = contactBody(planName, currentPlan);
  return `${baseWhatsappUrl}?text=${text}`;
}

function emailUrl(planName: string, currentPlan: string, email: string) {
  return `mailto:${email}?subject=${contactSubject(planName, currentPlan)}&body=${contactBody(planName, currentPlan)}`;
}

async function billingAuthFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token)
    return { res: null as Response | null, token: null as string | null };
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  return { res, token };
}

function BillingPage() {
  const sub = useSubscription();
  const students = useStudents();
  const qc = useQueryClient();
  const { email, phone, whatsappUrl: contactWhatsappUrl } = getContactConfig();

  const [syncing, setSyncing] = useState(false);

  const dbPlan = (sub.data?.plan ?? "free") as PlanCode;
  const rawStatus = sub.data?.status ?? "active";
  const checkoutPending = CHECKOUT_PENDING_STATUSES.has(rawStatus);
  const billingLabel = checkoutPending
    ? "Payment pending"
    : rawStatus === "canceled"
      ? "Inactive"
      : rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);

  const effectivePlan = checkoutPending ? "free" : dbPlan;

  const currentRank = PLAN_RANK[effectivePlan];
  const limit = sub.data?.limit ?? 25;
  const used = students.data?.length ?? 0;
  const pct = Number.isFinite(limit)
    ? Math.min(100, Math.round((used / limit) * 100))
    : 0;
  const planMeta = PLANS.find((p) => p.code === effectivePlan);

  const syncSubscription = useCallback(async () => {
    setSyncing(true);
    try {
      const { res, token } = await billingAuthFetch(
        "/api/billing/sync-subscription",
        {
          method: "POST",
        },
      );
      if (!token) {
        toast.error("Please sign in again to continue.");
        return;
      }
      if (!res) return;

      let payload: { ok?: boolean; message?: string; synced?: boolean } = {};
      try {
        payload = await res.json();
      } catch {
        payload = {};
      }

      if (!res.ok || !payload.ok) {
        toast.error("Could not refresh payment status", {
          description: payload.message ?? `(${res.status})`,
        });
        return;
      }

      await qc.invalidateQueries({ queryKey: ["subscription"] });
    } catch (e: unknown) {
      toast.error("Connection problem", {
        description: "Check your internet and try again.",
      });
    } finally {
      setSyncing(false);
    }
  }, [qc]);

  useEffect(() => {
    if (!checkoutPending) return;
    void syncSubscription();
    const id = window.setInterval(() => void syncSubscription(), 20_000);
    return () => window.clearInterval(id);
  }, [checkoutPending, syncSubscription]);

  return (
    <RoutePermissionGate resource="billing" level="read">
      <div>
        <PageHeader
          title="Billing & plans"
          description="Compare all Vidya plans. To upgrade, downgrade, or change your subscription, contact us directly on WhatsApp or email and we'll handle it for you."
        />

        {sub.data && !sub.data.isOwner && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="py-3 text-sm text-muted-foreground">
              You're viewing the institute owner's billing. Only the owner can
              change the plan — please ask them to contact support.
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 overflow-hidden border-primary/20">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Current access
                </span>
                <Badge variant="secondary" className="capitalize">
                  {planMeta?.name ?? effectivePlan}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-wide"
                >
                  {billingLabel}
                </Badge>
              </div>
              <h2 className="mt-1 font-display text-2xl font-semibold">
                {planMeta?.name} —{" "}
                <span className="text-muted-foreground">
                  {planMeta?.price === 0
                    ? "Free"
                    : `₹${planMeta?.price.toLocaleString("en-IN")}/mo`}
                </span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {planMeta?.tagline}
              </p>

              {checkoutPending && (
                <div className="mt-4 space-y-2 rounded-lg border border-amber-500/35 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
                  <p>
                    Finish Razorpay checkout in the tab we opened (or start
                    checkout again if you closed it). Your plan unlocks
                    automatically after payment — we also check with Razorpay
                    every few seconds.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={syncing}
                    onClick={() => void syncSubscription()}
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />{" "}
                        Checking payment…
                      </>
                    ) : (
                      "Refresh payment status"
                    )}
                  </Button>
                </div>
              )}

              <div className="mt-5 max-w-md">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Students</span>
                  <span className="font-medium">
                    {students.isLoading ? "—" : used} /{" "}
                    {Number.isFinite(limit) ? limit : "∞"}
                  </span>
                </div>
                {students.isLoading ? (
                  <Skeleton className="h-2" />
                ) : (
                  <Progress
                    value={pct}
                    className={cn(pct >= 90 && "[&>div]:bg-destructive")}
                  />
                )}
                {pct >= 100 && (
                  <p className="mt-2 text-xs text-destructive">
                    You&apos;ve hit your plan limit. Upgrade to add more
                    students.
                  </p>
                )}
                {pct >= 80 && pct < 100 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    You&apos;re approaching your plan limit.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-2 md:w-[220px]">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full gap-2"
              >
                <Link to="/settings">
                  <CreditCard className="h-4 w-4" /> Institute & billing email
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => {
            const isCurrent = p.code === effectivePlan;
            const rank = PLAN_RANK[p.code];
            const isDowngrade = rank < currentRank;
            const highlight = p.code === "growth";

            return (
              <Card
                key={p.code}
                className={cn(
                  "relative flex flex-col transition-shadow",
                  highlight && "ring-1 ring-primary/40 shadow-md",
                  isCurrent && "border-primary",
                )}
              >
                {highlight && !isCurrent && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                    Recommended
                  </span>
                )}
                <CardContent className="flex flex-1 flex-col gap-4 p-5">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-semibold">
                        {p.name}
                      </h3>
                      {isCurrent && <Badge variant="secondary">Active</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.tagline}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-3xl font-bold">
                        {p.price === 0
                          ? "Free"
                          : `₹${p.price.toLocaleString("en-IN")}`}
                      </span>
                      {p.price !== 0 && (
                        <span className="text-xs text-muted-foreground">
                          /mo
                        </span>
                      )}
                    </div>
                    {p.price !== 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        or ₹{p.annualPrice.toLocaleString("en-IN")}/year
                        {p.setupFee > 0
                          ? ` · ₹${p.setupFee.toLocaleString("en-IN")} setup on monthly`
                          : ""}
                      </p>
                    )}
                  </div>
                  <ul className="flex-1 space-y-2 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {p.code === "free" ? (
                    <Button variant="outline" disabled className="w-full">
                      Included for every institute
                    </Button>
                  ) : isCurrent ? (
                    <Button variant="secondary" disabled className="w-full">
                      Current tier
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {contactWhatsappUrl && (
                        <Button asChild className="w-full gap-2">
                          <a
                            href={planWhatsappHref(
                              p.name,
                              planMeta?.name ?? effectivePlan,
                              contactWhatsappUrl,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-4 w-4" />
                            {isDowngrade
                              ? "Request downgrade"
                              : "Upgrade on WhatsApp"}
                          </a>
                        </Button>
                      )}
                      {email && (
                        <Button
                          asChild
                          variant={contactWhatsappUrl ? "outline" : "default"}
                          className="w-full gap-2"
                        >
                          <a
                            href={emailUrl(
                              p.name,
                              planMeta?.name ?? effectivePlan,
                              email,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Mail className="h-4 w-4" />
                            Email to switch
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-8 overflow-hidden border-primary/20">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h3 className="font-display text-lg font-semibold">
                Need to change your plan?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Reach out directly and we&apos;ll upgrade or downgrade your
                subscription right away.
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 md:w-[240px]">
              {contactWhatsappUrl && (
                <Button asChild className="w-full gap-2">
                  <a
                    href={contactWhatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp {phone || "us"}
                  </a>
                </Button>
              )}
              {email && (
                <Button
                  asChild
                  variant={contactWhatsappUrl ? "outline" : "default"}
                  className="w-full gap-2"
                >
                  <a
                    href={`mailto:${email}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Mail className="h-4 w-4" />
                    Email support
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-[11px] text-muted-foreground leading-relaxed max-w-xl mx-auto">
          Paid plans are arranged by invoice. Online payment is coming soon.
          Existing Razorpay subscriptions are still synced automatically.
        </p>
      </div>
    </RoutePermissionGate>
  );
}
