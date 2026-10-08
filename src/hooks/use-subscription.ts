import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { APPROVED_PRICING, type PlanDisplay } from "@/lib/pricing-display";
import {
  PLAN_STUDENT_LIMITS,
  UNLIMITED_STUDENT_SENTINEL,
  type PlanCode,
} from "@/lib/plan-limits";

export type { PlanCode };

function toPlanCode(code: PlanDisplay["code"]): PlanCode {
  return code === "large" ? "pro" : code;
}

// ── Trial mode ──────────────────────────────────────────────────────
// When true, every account is treated as the highest plan (no caps,
// every feature unlocked). When false, plans are enforced both in the
// UI and by the `enforce_student_limit` DB trigger.
export const TRIAL_MODE = false;

export const PLAN_LIMITS: Record<PlanCode, number> = {
  free: PLAN_STUDENT_LIMITS.free ?? 25,
  starter: PLAN_STUDENT_LIMITS.starter ?? 100,
  growth: PLAN_STUDENT_LIMITS.growth ?? 500,
  pro: UNLIMITED_STUDENT_SENTINEL,
};

export const PLAN_RANK: Record<PlanCode, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  pro: 3,
};

export const PLANS: {
  code: PlanCode;
  name: string;
  price: number;
  annualPrice: number;
  setupFee: number;
  tagline: string;
  features: string[];
}[] = APPROVED_PRICING.map((p) => ({
  code: toPlanCode(p.code),
  name: p.displayName,
  price: p.monthlyPrice,
  annualPrice: p.annualPrice,
  setupFee: p.setupFee,
  tagline: p.tagline,
  features: p.features,
}));

type HealthRow = {
  plan: PlanCode;
  raw_plan: PlanCode;
  status: string;
  start_date: string | null;
  expiry_date: string | null;
  current_period_end: string | null;
  plan_price: number | null;
  notes: string | null;
  limit: number;
  student_count: number;
  over_limit: boolean;
  over_by: number;
  days_until_expiry: number | null;
  expired: boolean;
  setup_fee_paid?: boolean;
};

const FALLBACK_SUBSCRIPTION_COLUMNS =
  "plan, status, current_period_end, start_date, expiry_date, plan_price, notes";

type SubscriptionRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
};

/** Exported for tests: staff must call RPC with the workspace owner id. */
export async function fetchSubscriptionForOwner(
  supabase: SubscriptionRpcClient,
  ownerId: string,
  isOwner: boolean,
) {
  const { data: healthRaw, error: healthErr } = await supabase.rpc(
    "subscription_health",
    { _uid: ownerId },
  );

  if (!healthErr && healthRaw) {
    const h = healthRaw as HealthRow;
    return {
      plan: h.plan,
      rawPlan: h.raw_plan,
      status: h.status,
      start_date: h.start_date,
      expiry_date: h.expiry_date,
      current_period_end: h.current_period_end,
      plan_price: h.plan_price,
      notes: h.notes,
      limit: h.limit,
      student_count: h.student_count,
      over_limit: h.over_limit,
      over_by: h.over_by,
      days_until_expiry: h.days_until_expiry,
      expired: h.expired,
      trial: false,
      setup_fee_paid: Boolean(
        h.setup_fee_paid || h.raw_plan !== "free" || !!h.expiry_date,
      ),
      isOwner,
    };
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select(FALLBACK_SUBSCRIPTION_COLUMNS)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  const row = data as {
    plan: PlanCode;
    status: string;
    current_period_end: string | null;
    start_date: string | null;
    expiry_date: string | null;
    plan_price: number | null;
    notes: string | null;
  } | null;
  const plan = (row?.plan ?? "free") as PlanCode;
  const status = row?.status ?? "active";
  const expiry = row?.expiry_date ?? null;
  const expired =
    status === "expired" ||
    status === "suspended" ||
    status === "canceled" ||
    (!!expiry && new Date(expiry).getTime() < Date.now());
  const effectivePlan: PlanCode = expired ? "free" : plan;
  const daysLeft = expiry
    ? Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000)
    : null;
  return {
    plan: effectivePlan,
    rawPlan: plan,
    status,
    start_date: row?.start_date ?? null,
    expiry_date: expiry,
    current_period_end: row?.current_period_end ?? null,
    plan_price: row?.plan_price ?? null,
    notes: row?.notes ?? null,
    limit: PLAN_LIMITS[effectivePlan],
    student_count: 0,
    over_limit: false,
    over_by: 0,
    days_until_expiry: daysLeft,
    expired,
    trial: false,
    setup_fee_paid: plan !== "free" || !!expiry,
    isOwner,
  };
}

export function useSubscription() {
  const { user } = useAuth();
  const { active } = useActiveWorkspace();
  // Subscriptions are per institute owner. Invited staff must inherit the
  // active workspace owner's plan, not their personal (free) subscription.
  const ownerId = active?.ownerId ?? user?.id;
  const isOwner = !!user && !!ownerId && user.id === ownerId;
  return useQuery({
    queryKey: ["subscription", ownerId],
    enabled: !!user && !!ownerId,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    queryFn: async () => {
      if (TRIAL_MODE) {
        return {
          plan: "pro" as PlanCode,
          rawPlan: "pro" as PlanCode,
          status: "active",
          start_date: null,
          expiry_date: null,
          current_period_end: null,
          plan_price: null,
          notes: null,
          limit: Infinity,
          student_count: 0,
          over_limit: false,
          over_by: 0,
          days_until_expiry: null as number | null,
          expired: false,
          trial: true,
          setup_fee_paid: true,
          isOwner,
        };
      }

      const { supabase } = await import("@/integrations/supabase/client");
      return fetchSubscriptionForOwner(
        supabase as unknown as SubscriptionRpcClient,
        ownerId!,
        isOwner,
      );
    },
  });
}

export function hasMinPlan(current: PlanCode | undefined, min: PlanCode) {
  if (TRIAL_MODE) return true;
  if (!current) return false;
  return PLAN_RANK[current] >= PLAN_RANK[min];
}
