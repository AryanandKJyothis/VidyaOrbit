import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Loader2, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  formatLimit,
  isUnlimited,
  studentLimitForPlan,
  type PlanCode,
} from "@/lib/plan-limits";
import { formatIndianPrice, getPlanByCode } from "@/lib/pricing-display";
import {
  getSubscriptionDetail,
  getInstituteHealth,
  updateSubscription,
  extendSubscription,
  grantTrial,
  updateInstituteAdminNotes,
  dismissBillingReview,
} from "@/lib/admin-subscriptions.functions";
import { PLANS } from "@/hooks/use-subscription";

export function relTime(d: string | null) {
  if (!d) return "—";
  try {
    return formatDistanceToNowStrict(new Date(d), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function expiryTone(
  days: number | null,
): "neutral" | "warning" | "danger" {
  if (days == null) return "neutral";
  if (days <= 7) return "danger";
  if (days <= 30) return "warning";
  return "neutral";
}

export function activityTone(
  d: string | null,
): "neutral" | "warning" | "danger" {
  if (!d) return "danger";
  const days = (Date.now() - new Date(d).getTime()) / 86400_000;
  if (days > 30) return "danger";
  if (days > 7) return "warning";
  return "neutral";
}

export const adminToneText: Record<"neutral" | "warning" | "danger", string> = {
  neutral: "text-muted-foreground",
  warning: "text-amber-600 dark:text-amber-500",
  danger: "text-red-600 dark:text-red-500 font-medium",
};

export function EditSubscriptionDialog({
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
  const dismissReviewFn = useServerFn(dismissBillingReview);

  const detail = useQuery({
    queryKey: ["admin-sub", ownerId],
    queryFn: () => detailFn({ data: { owner_id: ownerId } }),
  });
  const health = useQuery({
    queryKey: ["admin-health", ownerId],
    queryFn: () => healthFn({ data: { owner_id: ownerId } }),
  });

  const sub = detail.data?.sub as
    | {
        plan: string;
        status: string;
        start_date: string | null;
        expiry_date: string | null;
        plan_price: number | null;
        notes: string | null;
        setup_fee_paid?: boolean;
      }
    | null
    | undefined;
  const inst = detail.data?.inst as
    | { name: string; contact_email: string; admin_notes: string | null }
    | null
    | undefined;
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
  const reviews = (detail.data?.reviews ?? []) as Array<{
    id: string;
    tier: string;
    cycle: string;
    amount_paise: number;
    currency: string;
    razorpay_order_id: string;
    razorpay_payment_id: string | null;
    paid_at: string | null;
    review_reason: string | null;
  }>;

  const [plan, setPlan] = useState<string>("free");
  const [status, setStatus] = useState<string>("active");
  const [startDate, setStartDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [setupFeePaid, setSetupFeePaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOverLimit, setConfirmOverLimit] = useState<{
    student_count: number;
    new_limit: number;
    over_by: number;
    new_plan: string;
  } | null>(null);

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
    setSetupFeePaid(Boolean(sub?.setup_fee_paid));
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-sub", ownerId] });
    qc.invalidateQueries({ queryKey: ["admin-health", ownerId] });
    onSaved();
  };

  const normalizeStatus = (
    s: string,
  ): "active" | "trialing" | "past_due" | "canceled" | "pending_checkout" => {
    if (s === "trial") return "trialing";
    if (s === "expired" || s === "suspended") return "canceled";
    if (
      [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "pending_checkout",
      ].includes(s)
    ) {
      return s as
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "pending_checkout";
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
          setup_fee_paid: setupFeePaid,
        },
      });
      if (
        res &&
        (res as { requires_confirmation?: boolean }).requires_confirmation
      ) {
        const r = res as {
          student_count: number;
          new_limit: number;
          over_by: number;
          new_plan: string;
        };
        setConfirmOverLimit({
          student_count: r.student_count,
          new_limit: r.new_limit,
          over_by: r.over_by,
          new_plan: r.new_plan,
        });
        return;
      }
      await notesFn({
        data: { owner_id: ownerId, admin_notes: adminNotes || null },
      });
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

  const quick = async (
    kind: "trial30" | "trial90" | "ext30" | "ext90" | "ext365",
  ) => {
    setBusy(kind);
    try {
      if (kind === "trial30")
        await trialFn({
          data: {
            owner_id: ownerId,
            days: 30,
            plan: (plan as never) ?? "starter",
          },
        });
      else if (kind === "trial90")
        await trialFn({
          data: {
            owner_id: ownerId,
            days: 90,
            plan: (plan as never) ?? "starter",
          },
        });
      else if (kind === "ext30")
        await extendFn({ data: { owner_id: ownerId, days: 30 } });
      else if (kind === "ext90")
        await extendFn({ data: { owner_id: ownerId, days: 90 } });
      else if (kind === "ext365")
        await extendFn({ data: { owner_id: ownerId, days: 365 } });
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
  const lastActive =
    [
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
  const planLimitFromForm = studentLimitForPlan((plan as PlanCode) || "free");
  const usagePct = isUnlimited(planLimitFromForm)
    ? 0
    : Math.min(
        100,
        Math.round((studentTotal / Math.max(1, planLimitFromForm ?? 1)) * 100),
      );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inst?.name ?? "Subscription"}</DialogTitle>
          <p className="text-xs text-muted-foreground">{inst?.contact_email}</p>
        </DialogHeader>

        {detail.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <div className="space-y-5">
            {reviews.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  Paid order needs review
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Money was captured. Read the reason below — refund setup if it
                  was charged twice, or apply/refund a mid-term tier change —
                  then dismiss.
                </p>
                <div className="mt-2 space-y-2">
                  {reviews.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-md border bg-background p-2 text-xs"
                    >
                      <p className="font-medium capitalize">
                        {r.tier} {r.cycle} · ₹
                        {Math.round(r.amount_paise / 100).toLocaleString(
                          "en-IN",
                        )}{" "}
                        · {r.razorpay_order_id}
                      </p>
                      {r.review_reason && (
                        <p className="mt-1 text-muted-foreground">
                          {r.review_reason}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        disabled={busy !== null}
                        onClick={async () => {
                          setBusy("dismiss-review");
                          try {
                            await dismissReviewFn({
                              data: { owner_id: ownerId, order_id: r.id },
                            });
                            toast.success("Review dismissed");
                            refresh();
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "Failed",
                            );
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        Dismiss review
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity & usage */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Days until downgrade
                  </p>
                  <p
                    className={cn(
                      "text-3xl font-semibold tabular-nums",
                      daysLeft != null &&
                        daysLeft <= 7 &&
                        "text-red-600 dark:text-red-500",
                      daysLeft != null &&
                        daysLeft > 7 &&
                        daysLeft <= 30 &&
                        "text-amber-600 dark:text-amber-500",
                    )}
                  >
                    {daysLeft == null
                      ? "—"
                      : daysLeft < 0
                        ? `expired ${Math.abs(daysLeft)}d`
                        : daysLeft}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Student usage</p>
                  <p className="text-3xl font-semibold tabular-nums">
                    {studentTotal}
                    <span className="text-base text-muted-foreground">
                      {" "}
                      / {formatLimit(planLimitFromForm)}
                    </span>
                  </p>
                  {!isUnlimited(planLimitFromForm) && (
                    <Progress value={usagePct} className="mt-2 h-1.5" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last active</p>
                  <p className="text-3xl font-semibold">
                    {relTime(lastActive)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <StatPill
                  icon={Users}
                  label="Attendance"
                  count30={num("attendance_30d")}
                  count90={num("attendance_90d")}
                />
                <StatPill
                  icon={Users}
                  label="Payments"
                  count30={num("payments_30d")}
                  count90={num("payments_90d")}
                  sub={`₹${Number(h.payments_amount_30d ?? 0).toLocaleString("en-IN")}`}
                />
                <StatPill
                  icon={Users}
                  label="New students"
                  count30={num("students_30d")}
                  count90={num("students_90d")}
                />
                <StatPill
                  icon={Users}
                  label="Batch edits"
                  count30={num("batches_30d")}
                  count90={num("batches_90d")}
                />
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Spark</SelectItem>
                    <SelectItem value="growth">Orbit</SelectItem>
                    <SelectItem value="pro">
                      {PLANS.find((p) => p.code === "pro")?.name ?? "Centre"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trialing">Trialing</SelectItem>
                    <SelectItem value="past_due">Past due</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                    <SelectItem value="pending_checkout">
                      Pending checkout
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Expiry date</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Plan price (₹)</Label>
                <Input
                  type="number"
                  value={planPrice}
                  onChange={(e) => setPlanPrice(e.target.value)}
                  placeholder="e.g. 499"
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 sm:col-span-2">
                <div>
                  <Label htmlFor="setup-fee-paid">Setup fee already paid</Label>
                  <p className="text-xs text-muted-foreground">
                    Any captured online payment or an invoice you mark paid.
                    When on, checkout will not charge{" "}
                    {formatIndianPrice(getPlanByCode("growth")!.setupFee)} setup
                    again. Turning this off will not make setup chargeable again
                    once an online payment has been captured.
                  </p>
                </div>
                <Switch
                  id="setup-fee-paid"
                  checked={setupFeePaid}
                  onCheckedChange={setSetupFeePaid}
                />
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
                    {busy === k ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>User-visible notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Shown on /plan to the user"
              />
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
                {audit.length === 0 && (
                  <p className="text-muted-foreground">No changes yet.</p>
                )}
                {audit.map((a, i) => (
                  <div key={i} className="rounded border bg-background p-2">
                    <p className="font-medium">
                      {a.old_plan ?? "—"} → {a.new_plan ?? "—"} ·{" "}
                      {a.old_status ?? "—"} → {a.new_status ?? "—"}
                    </p>
                    <p className="text-muted-foreground">
                      {format(new Date(a.changed_at), "d MMM yyyy HH:mm")}
                      {a.new_expiry
                        ? ` · expires ${format(new Date(a.new_expiry), "d MMM yyyy")}`
                        : ""}
                      {a.new_price != null ? ` · ₹${a.new_price}` : ""}
                    </p>
                    {a.note && (
                      <p className="text-muted-foreground">“{a.note}”</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={!!confirmOverLimit}
        onOpenChange={(open) => !open && setConfirmOverLimit(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Downgrade will exceed plan limit
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmOverLimit && (
                <>
                  This workspace has{" "}
                  <strong>{confirmOverLimit.student_count} students</strong>,
                  but{" "}
                  <strong className="capitalize">
                    {confirmOverLimit.new_plan}
                  </strong>{" "}
                  only allows{" "}
                  <strong>{formatLimit(confirmOverLimit.new_limit)}</strong>{" "}
                  (over by {confirmOverLimit.over_by}).
                  <br />
                  <br />
                  All existing student, batch, fee, and attendance data will be
                  kept and remain fully accessible. The owner just won't be able
                  to add new students until they upgrade or remove some.
                  Proceed?
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
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{count30}</p>
      <p className="text-xs text-muted-foreground">
        {sub ? `${sub} · ` : ""}90d: {count90}
      </p>
    </div>
  );
}

function FeatureBars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="mt-4 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        Feature usage (last 30 days)
      </p>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 text-muted-foreground">
            {it.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${(it.value / max) * 100}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right tabular-nums">
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}
