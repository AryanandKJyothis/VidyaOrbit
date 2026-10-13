import {
  AlertTriangle,
  Building2,
  Clock,
  CreditCard,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/format";
import { paiseToRupees, type AdminOverview } from "@/lib/admin-mrr";
import { PLAN_DISPLAY_NAMES, type PlanCode } from "@/lib/plan-limits";
import { cn } from "@/lib/utils";

function planLabel(plan: string) {
  return PLAN_DISPLAY_NAMES[plan as PlanCode] ?? plan;
}

export function AdminOverviewPanel({
  data,
  onJump,
}: {
  data: AdminOverview;
  onJump?: (
    to: "/admin/centres" | "/admin/users" | "/admin/payments" | "/admin/alerts",
  ) => void;
}) {
  const mixMax = Math.max(1, ...data.plan_mix.map((p) => p.count));
  const trendUsers = data.signup_trend.map((p) => p.users);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          className="w-full text-left"
          onClick={() => onJump?.("/admin/centres")}
        >
          <StatCard
            label="Centres"
            value={String(data.centres)}
            hint={`${data.paying} paying`}
            icon={Building2}
            index={0}
          />
        </button>
        <button
          type="button"
          className="w-full text-left"
          onClick={() => onJump?.("/admin/users")}
        >
          <StatCard
            label="Active users · 30d"
            value={String(data.active_users_30d)}
            hint={`${data.active_users_7d} in 7 days · ${data.users} total`}
            icon={Users}
            sparkline={trendUsers}
            index={1}
          />
        </button>
        <StatCard
          label="Sign-ups · 30d"
          value={String(data.signups_30d)}
          hint={`${data.signups_7d} users / ${data.centre_signups_7d} centres this week`}
          icon={UserPlus}
          sparkline={trendUsers}
          index={2}
        />
        <button
          type="button"
          className="w-full text-left"
          onClick={() => onJump?.("/admin/payments")}
        >
          <StatCard
            label="MRR"
            value={formatINR(paiseToRupees(data.mrr_paise))}
            hint={`${formatINR(paiseToRupees(data.revenue_30d_paise))} captured · 30d live`}
            icon={TrendingUp}
            tone="success"
            index={3}
          />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Trials"
          value={String(data.trials)}
          hint={`${data.trials_ending_7d} ending in 7 days`}
          icon={Clock}
          tone={data.trials_ending_7d > 0 ? "warning" : "default"}
          index={4}
        />
        <StatCard
          label="Expiring · 30d"
          value={String(data.expiring_30d)}
          hint={`${data.expiring_7d} in 7 days`}
          icon={Clock}
          tone={data.expiring_7d > 0 ? "warning" : "default"}
          index={5}
        />
        <StatCard
          label="Over student cap"
          value={String(data.over_limit)}
          hint="Active students vs plan limit"
          icon={AlertTriangle}
          tone={data.over_limit > 0 ? "destructive" : "default"}
          index={6}
        />
        <button
          type="button"
          className="w-full text-left"
          onClick={() => onJump?.("/admin/alerts")}
        >
          <StatCard
            label="Needs review"
            value={String(data.needs_review)}
            hint={`${data.webhook_errors} webhook errors`}
            icon={CreditCard}
            tone={
              data.needs_review + data.webhook_errors > 0
                ? "destructive"
                : "default"
            }
            index={7}
          />
        </button>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <p className="type-kicker text-muted-foreground">Plan mix</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Effective plan on each centre (expired and canceled count as Free).
          </p>
          <div className="mt-4 space-y-2">
            {data.plan_mix.length === 0 && (
              <p className="text-sm text-muted-foreground">No centres yet.</p>
            )}
            {data.plan_mix.map((row) => (
              <div key={row.plan} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 font-medium">
                  {planLabel(row.plan)}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full bg-primary",
                      row.plan === "pro" && "bg-brand-teal",
                      row.plan === "growth" && "bg-primary",
                      row.plan === "starter" && "bg-brand-saffron",
                      row.plan === "free" && "bg-muted-foreground/40",
                    )}
                    style={{ width: `${(row.count / mixMax) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
                  {row.count}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
