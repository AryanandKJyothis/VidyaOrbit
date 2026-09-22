import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Search, Loader2, AlertTriangle, Clock, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  checkAdmin,
  listInstitutes,
  getSubscriptionDetail,
  getInstituteHealth,
  updateSubscription,
  extendSubscription,
  grantTrial,
  updateInstituteAdminNotes,
} from "@/lib/admin-subscriptions.functions";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  beforeLoad: async () => {
    const res = await checkAdmin();
    if (!res.admin) throw redirect({ to: "/dashboard" });
  },
  component: AdminSubscriptionsPage,
});

type Row = Awaited<ReturnType<typeof listInstitutes>>[number];
type Filter = "all" | "expiring" | "over_limit" | "at_risk" | "inactive" | "trials" | "free";
type Sort = "expiring" | "most_students" | "least_active" | "recently_active" | "name";

function AdminSubscriptionsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("expiring");
  const [selected, setSelected] = useState<string | null>(null);
  const listFn = useServerFn(listInstitutes);
  const list = useQuery({
    queryKey: ["admin-institutes", search],
    queryFn: () => listFn({ data: { search: search || undefined } }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  const rows = (list.data ?? []) as Row[];

  const kpis = useMemo(() => {
    const now = Date.now();
    const inDays = (d: string | null, n: number) =>
      !!d && new Date(d).getTime() - now <= n * 86400_000 && new Date(d).getTime() - now > 0;
    return {
      paying: rows.filter(
        (r) =>
          r.sub?.plan && r.sub.plan !== "free" && r.sub.status !== "canceled",
      ).length,
      expiring30: rows.filter((r) => inDays(r.sub?.expiry_date ?? null, 30)).length,
      trialsEnding: rows.filter(
        (r) => r.sub?.status === "trialing" && inDays(r.sub?.expiry_date ?? null, 7),
      ).length,
      overLimit: rows.filter((r) => r.student_count > r.plan_limit).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const now = Date.now();
    let out = rows.slice();
    if (filter === "expiring") {
      out = out.filter((r) => {
        const d = r.sub?.expiry_date;
        return !!d && new Date(d).getTime() - now <= 30 * 86400_000;
      });
    } else if (filter === "over_limit") {
      out = out.filter((r) => r.student_count > r.plan_limit);
    } else if (filter === "at_risk") {
      // Used the app before but has been quiet for 7–30 days — prime
      // candidates for a re-engagement nudge before they fully churn.
      out = out.filter((r) => {
        if (!r.last_active_at) return false;
        const gap = now - new Date(r.last_active_at).getTime();
        return gap > 7 * 86400_000 && gap <= 30 * 86400_000;
      });
    } else if (filter === "inactive") {
      out = out.filter(
        (r) => !r.last_active_at || now - new Date(r.last_active_at).getTime() > 30 * 86400_000,
      );
    } else if (filter === "trials") {
      out = out.filter((r) => r.sub?.status === "trialing");
    } else if (filter === "free") {
      out = out.filter((r) => (r.sub?.plan ?? "free") === "free");
    }
    const num = (n: number | null | undefined) => (n == null ? Number.POSITIVE_INFINITY : n);
    const ts = (s: string | null | undefined) => (s ? new Date(s).getTime() : 0);
    out.sort((a, b) => {
      if (sort === "expiring") return num(a.days_until_expiry) - num(b.days_until_expiry);
      if (sort === "most_students") return b.student_count - a.student_count;
      if (sort === "least_active") return ts(a.last_active_at) - ts(b.last_active_at);
      if (sort === "recently_active") return ts(b.last_active_at) - ts(a.last_active_at);
      return a.name.localeCompare(b.name);
    });
    return out;
  }, [rows, filter, sort]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Manager"
        description="Customer health across every institute — expiring, over-limit, inactive, and what they actually use."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon={TrendingUp} label="Paying customers" value={kpis.paying} tone="growth" />
        <KpiTile
          icon={Clock}
          label="Expiring in 30 days"
          value={kpis.expiring30}
          tone={kpis.expiring30 > 0 ? "warning" : "neutral"}
          onClick={() => setFilter("expiring")}
        />
        <KpiTile
          icon={Clock}
          label="Trials ending ≤ 7 days"
          value={kpis.trialsEnding}
          tone={kpis.trialsEnding > 0 ? "warning" : "neutral"}
          onClick={() => setFilter("trials")}
        />
        <KpiTile
          icon={AlertTriangle}
          label="Over plan limit"
          value={kpis.overLimit}
          tone={kpis.overLimit > 0 ? "danger" : "neutral"}
          onClick={() => setFilter("over_limit")}
        />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by institute name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["expiring", "Expiring ≤30d"],
                  ["over_limit", "Over limit"],
                  ["at_risk", "At risk (7–30d idle)"],
                  ["inactive", "Dropped 30d+"],
                  ["trials", "Trials"],
                  ["free", "Free"],
                ] as [Filter, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    filter === k
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expiring">Expiring soonest</SelectItem>
                <SelectItem value="most_students">Most students</SelectItem>
                <SelectItem value="least_active">Least active</SelectItem>
                <SelectItem value="recently_active">Recently active</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="divide-y">
              {filtered.map((row) => (
                <InstituteRow key={row.owner_id} row={row} onOpen={() => setSelected(row.owner_id)} />
              ))}
              {filtered.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">No institutes match.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <EditDialog
          ownerId={selected}
          onClose={() => setSelected(null)}
          onSaved={() => list.refetch()}
        />
      )}
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  tone: "neutral" | "warning" | "danger" | "growth";
  onClick?: () => void;
}) {
  const toneClass = {
    neutral: "text-foreground",
    warning: "text-amber-600 dark:text-amber-500",
    danger: "text-red-600 dark:text-red-500",
    growth: "text-emerald-600 dark:text-emerald-500",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "rounded-lg border bg-card p-4 text-left transition-colors",
        onClick && "hover:bg-muted/40 cursor-pointer",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", toneClass)} />
      </div>
      <p className={cn("mt-2 text-3xl font-semibold tabular-nums", toneClass)}>{value}</p>
    </button>
  );
}

function relTime(d: string | null) {
  if (!d) return "—";
  try {
    return formatDistanceToNowStrict(new Date(d), { addSuffix: true });
  } catch {
    return "—";
  }
}

function expiryTone(days: number | null): "neutral" | "warning" | "danger" {
  if (days == null) return "neutral";
  if (days <= 7) return "danger";
  if (days <= 30) return "warning";
  return "neutral";
}

function activityTone(d: string | null): "neutral" | "warning" | "danger" {
  if (!d) return "danger";
  const days = (Date.now() - new Date(d).getTime()) / 86400_000;
  if (days > 30) return "danger";
  if (days > 7) return "warning";
  return "neutral";
}

const toneText: Record<"neutral" | "warning" | "danger", string> = {
  neutral: "text-muted-foreground",
  warning: "text-amber-600 dark:text-amber-500",
  danger: "text-red-600 dark:text-red-500 font-medium",
};

function InstituteRow({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const usagePct = Math.min(100, Math.round((row.student_count / Math.max(1, row.plan_limit)) * 100));
  const usageTone =
    row.student_count >= row.plan_limit
      ? "bg-red-500"
      : usagePct >= 80
        ? "bg-amber-500"
        : "bg-emerald-500";
  const expTone = expiryTone(row.days_until_expiry);
  const actTone = activityTone(row.last_active_at);
  const expiryText =
    row.days_until_expiry == null
      ? "no expiry"
      : row.days_until_expiry < 0
        ? `expired ${Math.abs(row.days_until_expiry)}d ago`
        : `in ${row.days_until_expiry}d`;

  return (
    <button
      onClick={onOpen}
      className="grid w-full grid-cols-12 items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
    >
      <div className="col-span-12 min-w-0 md:col-span-3">
        <p className="truncate text-sm font-semibold">{row.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.contact_email ?? "—"}
        </p>
        {row.member_emails && row.member_emails.length > 0 && (
          <p
            className="mt-0.5 truncate text-[11px] text-muted-foreground/80"
            title={row.member_emails.join(", ")}
          >
            <span className="font-medium text-muted-foreground">
              {row.member_emails.length} member{row.member_emails.length === 1 ? "" : "s"}:
            </span>{" "}
            {row.member_emails.join(", ")}
          </p>
        )}
      </div>

      <div className="col-span-6 flex flex-wrap items-center gap-1.5 md:col-span-2">
        <Badge variant="outline" className="capitalize">{row.sub?.plan ?? "free"}</Badge>
        <Badge
          variant={
            row.sub?.status === "active" || row.sub?.status === "trialing"
              ? "default"
              : "destructive"
          }
          className="capitalize"
        >
          {row.sub?.status ?? "active"}
        </Badge>
      </div>
      <div className="col-span-6 md:col-span-3">
        <div className="flex items-center justify-between text-xs">
          <span className="tabular-nums">
            {row.student_count} / {row.plan_limit}
          </span>
          <span className="text-muted-foreground">{usagePct}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full", usageTone)} style={{ width: `${usagePct}%` }} />
        </div>
      </div>
      <div className={cn("col-span-4 text-xs tabular-nums md:col-span-2", toneText[expTone])}>
        {expiryText}
      </div>
      <div className={cn("col-span-4 text-xs md:col-span-1", toneText[actTone])}>
        {relTime(row.last_active_at)}
      </div>
      <div className="col-span-4 text-xs text-muted-foreground md:col-span-1">
        {row.top_feature_30d ?? "—"}
      </div>
    </button>
  );
}

function EditDialog({
  ownerId,
  onClose,
  onSaved,
}: {
  ownerId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const detailFn = useServerFn(getSubscriptionDetail);
  const healthFn = useServerFn(getInstituteHealth);
  const updateFn = useServerFn(updateSubscription);
  const extendFn = useServerFn(extendSubscription);
  const trialFn = useServerFn(grantTrial);
  const notesFn = useServerFn(updateInstituteAdminNotes);

  const detail = useQuery({
    queryKey: ["admin-sub", ownerId],
    queryFn: () => detailFn({ data: { owner_id: ownerId } }),
  });
  const health = useQuery({
    queryKey: ["admin-health", ownerId],
    queryFn: () => healthFn({ data: { owner_id: ownerId } }),
  });

  const sub = detail.data?.sub as
    | { plan: string; status: string; start_date: string | null; expiry_date: string | null; plan_price: number | null; notes: string | null }
    | null
    | undefined;
  const inst = detail.data?.inst as { name: string; contact_email: string; admin_notes: string | null } | null | undefined;
  const audit = (detail.data?.audit ?? []) as Array<{
    changed_at: string;
    old_plan: string | null;
    new_plan: string | null;
    old_status: string | null;
    new_status: string | null;
    new_expiry: string | null;
    new_price: number | null;
    note: string | null;
  }>;

  const [plan, setPlan] = useState<string>("free");
  const [status, setStatus] = useState<string>("active");
  const [startDate, setStartDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOverLimit, setConfirmOverLimit] = useState<
    { student_count: number; new_limit: number; over_by: number; new_plan: string } | null
  >(null);

  const initialized = useState({ done: false })[0];
  if (detail.data && !initialized.done) {
    initialized.done = true;
    setPlan(sub?.plan ?? "free");
    setStatus(sub?.status ?? "active");
    setStartDate(sub?.start_date ? sub.start_date.slice(0, 10) : "");
    setExpiryDate(sub?.expiry_date ? sub.expiry_date.slice(0, 10) : "");
    setPlanPrice(sub?.plan_price != null ? String(sub.plan_price) : "");
    setNotes(sub?.notes ?? "");
    setAdminNotes(inst?.admin_notes ?? "");
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-sub", ownerId] });
    qc.invalidateQueries({ queryKey: ["admin-health", ownerId] });
    onSaved();
  };

  const normalizeStatus = (s: string): "active" | "trialing" | "past_due" | "canceled" | "pending_checkout" => {
    if (s === "trial") return "trialing";
    if (s === "expired" || s === "suspended") return "canceled";
    if (["active", "trialing", "past_due", "canceled", "pending_checkout"].includes(s)) {
      return s as "active" | "trialing" | "past_due" | "canceled" | "pending_checkout";
    }
    return "active";
  };

  const performSave = async (confirm: boolean) => {
    setSaving(true);
    try {
      const res = await updateFn({
        data: {
          owner_id: ownerId,
          plan: plan as "free" | "starter" | "growth" | "pro",
          status: normalizeStatus(status),
          start_date: startDate ? new Date(startDate).toISOString() : null,
          expiry_date: expiryDate ? new Date(expiryDate).toISOString() : null,
          plan_price: planPrice ? Number(planPrice) : null,
          notes: notes || null,
          confirm,
        },
      });
      if (res && (res as { requires_confirmation?: boolean }).requires_confirmation) {
        const r = res as { student_count: number; new_limit: number; over_by: number; new_plan: string };
        setConfirmOverLimit({
          student_count: r.student_count,
          new_limit: r.new_limit,
          over_by: r.over_by,
          new_plan: r.new_plan,
        });
        return;
      }
      await notesFn({ data: { owner_id: ownerId, admin_notes: adminNotes || null } });
      toast.success("Subscription updated");
      setConfirmOverLimit(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const save = () => performSave(false);

  const quick = async (kind: "trial30" | "trial90" | "ext30" | "ext90" | "ext365") => {
    setBusy(kind);
    try {
      if (kind === "trial30") await trialFn({ data: { owner_id: ownerId, days: 30, plan: (plan as never) ?? "starter" } });
      else if (kind === "trial90") await trialFn({ data: { owner_id: ownerId, days: 90, plan: (plan as never) ?? "starter" } });
      else if (kind === "ext30") await extendFn({ data: { owner_id: ownerId, days: 30 } });
      else if (kind === "ext90") await extendFn({ data: { owner_id: ownerId, days: 90 } });
      else if (kind === "ext365") await extendFn({ data: { owner_id: ownerId, days: 365 } });
      toast.success("Done");
      initialized.done = false;
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  // Health derivations
  const h = (health.data ?? {}) as Record<string, number | string | null>;
  const num = (k: string) => Number(h[k] ?? 0);
  const lastActive = [
    h.last_attendance_at,
    h.last_payment_at,
    h.last_student_at,
    h.last_batch_at,
  ]
    .filter((x): x is string => typeof x === "string")
    .sort()
    .pop() ?? null;
  const daysLeft = expiryDate
    ? Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400_000)
    : null;
  const studentTotal = num("total_students");
  const planLimitFromForm =
    plan === "pro" ? 1000 : plan === "growth" ? 500 : plan === "starter" ? 100 : 25;
  const usagePct = Math.min(100, Math.round((studentTotal / Math.max(1, planLimitFromForm)) * 100));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inst?.name ?? "Subscription"}</DialogTitle>
          <p className="text-xs text-muted-foreground">{inst?.contact_email}</p>
        </DialogHeader>

        {detail.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-5">
            {/* Activity & usage */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Days until downgrade</p>
                  <p
                    className={cn(
                      "text-3xl font-semibold tabular-nums",
                      daysLeft != null && daysLeft <= 7 && "text-red-600 dark:text-red-500",
                      daysLeft != null && daysLeft > 7 && daysLeft <= 30 && "text-amber-600 dark:text-amber-500",
                    )}
                  >
                    {daysLeft == null ? "—" : daysLeft < 0 ? `expired ${Math.abs(daysLeft)}d` : daysLeft}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Student usage</p>
                  <p className="text-3xl font-semibold tabular-nums">
                    {studentTotal}
                    <span className="text-base text-muted-foreground"> / {planLimitFromForm}</span>
                  </p>
                  <Progress value={usagePct} className="mt-2 h-1.5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last active</p>
                  <p className="text-3xl font-semibold">{relTime(lastActive)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <StatPill icon={Users} label="Attendance" count30={num("attendance_30d")} count90={num("attendance_90d")} />
                <StatPill icon={Users} label="Payments" count30={num("payments_30d")} count90={num("payments_90d")} sub={`₹${Number(h.payments_amount_30d ?? 0).toLocaleString("en-IN")}`} />
                <StatPill icon={Users} label="New students" count30={num("students_30d")} count90={num("students_90d")} />
                <StatPill icon={Users} label="Batch edits" count30={num("batches_30d")} count90={num("batches_90d")} />
              </div>

              {/* Feature usage bars */}
              <FeatureBars
                items={[
                  { label: "Attendance", value: num("attendance_30d") },
                  { label: "Fees", value: num("payments_30d") },
                  { label: "Students", value: num("students_30d") },
                  { label: "Batches", value: num("batches_30d") },
                ]}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Plan</Label>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trialing">Trialing</SelectItem>
                    <SelectItem value="past_due">Past due</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                    <SelectItem value="pending_checkout">Pending checkout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>Expiry date</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
              <div>
                <Label>Plan price (₹)</Label>
                <Input type="number" value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} placeholder="e.g. 499" />
              </div>
            </div>

            <div>
              <Label>Quick actions</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {[
                  ["trial30", "Grant 30-day Trial"],
                  ["trial90", "Grant 90-day Trial"],
                  ["ext30", "Extend +30d"],
                  ["ext90", "Extend +90d"],
                  ["ext365", "Extend +365d"],
                ].map(([k, label]) => (
                  <Button
                    key={k}
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => quick(k as never)}
                  >
                    {busy === k ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>User-visible notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Shown on /plan to the user" />
            </div>

            <div>
              <Label>Internal admin notes</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                placeholder="Founder pricing, referral source, trial agreements, renewal notes (never shown to user)"
              />
            </div>

            <div>
              <Label>Audit log</Label>
              <div className="mt-1 max-h-56 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-2 text-xs">
                {audit.length === 0 && <p className="text-muted-foreground">No changes yet.</p>}
                {audit.map((a, i) => (
                  <div key={i} className="rounded border bg-background p-2">
                    <p className="font-medium">
                      {a.old_plan ?? "—"} → {a.new_plan ?? "—"} ·{" "}
                      {a.old_status ?? "—"} → {a.new_status ?? "—"}
                    </p>
                    <p className="text-muted-foreground">
                      {format(new Date(a.changed_at), "d MMM yyyy HH:mm")}
                      {a.new_expiry ? ` · expires ${format(new Date(a.new_expiry), "d MMM yyyy")}` : ""}
                      {a.new_price != null ? ` · ₹${a.new_price}` : ""}
                    </p>
                    {a.note && <p className="text-muted-foreground">“{a.note}”</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={!!confirmOverLimit} onOpenChange={(open) => !open && setConfirmOverLimit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Downgrade will exceed plan limit</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmOverLimit && (
                <>
                  This workspace has <strong>{confirmOverLimit.student_count} students</strong>, but{" "}
                  <strong className="capitalize">{confirmOverLimit.new_plan}</strong> only allows{" "}
                  <strong>{confirmOverLimit.new_limit}</strong> (over by {confirmOverLimit.over_by}).
                  <br />
                  <br />
                  All existing student, batch, fee, and attendance data will be kept and remain
                  fully accessible. The owner just won't be able to add new students until they
                  upgrade or remove some. Proceed?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                performSave(true);
              }}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Downgrade anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function StatPill({
  icon: Icon,
  label,
  count30,
  count90,
  sub,
}: {
  icon: typeof Clock;
  label: string;
  count30: number;
  count90: number;
  sub?: string;
}) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{count30}</p>
      <p className="text-[11px] text-muted-foreground">
        {sub ? `${sub} · ` : ""}90d: {count90}
      </p>
    </div>
  );
}

function FeatureBars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="mt-4 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Feature usage (last 30 days)</p>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 text-muted-foreground">{it.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${(it.value / max) * 100}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right tabular-nums">{it.value}</span>
        </div>
      ))}
    </div>
  );
}
