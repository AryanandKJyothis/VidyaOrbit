import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { planFromRazorpayPlanId } from "@/lib/razorpay-env";
import { isSubscribablePlan } from "@/lib/billing-plan-codes";

type PlanDb = Database["public"]["Enums"]["plan_code"];

type RzNotes = Record<string, unknown>;

export type RzWebhookSubscriptionEntity = {
  id?: string;
  customer_id?: string | null;
  status?: string;
  plan_id?: string;
  notes?: RzNotes | null;
  /** Unix seconds — Razorpay may send `current_end` or nested */
  current_end?: number | null;
};

const CHECKOUT_STATUSES = new Set(["pending_checkout", "processing_checkout"]);

function unixToIso(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

function readOwnerNote(
  ent: RzWebhookSubscriptionEntity | null | undefined,
): string | null {
  const raw = ent?.notes?.owner_id;
  if (typeof raw === "string") return raw.trim() || null;
  if (typeof raw === "number") return String(raw).trim() || null;
  return null;
}

function normalizeOwnerId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const id = v.trim();
  if (!id) return null;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id) ? id : null;
}

/** Resolve institute owner from webhook notes or our pending-checkout row. */
export async function resolveSubscriptionOwnerId(
  ent: RzWebhookSubscriptionEntity | null | undefined,
): Promise<string | null> {
  const fromNotes = normalizeOwnerId(readOwnerNote(ent));
  if (fromNotes) return fromNotes;
  if (!ent?.id) return null;

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("owner_id")
    .eq("razorpay_subscription_id", ent.id)
    .maybeSingle();

  if (error) {
    console.error("[resolveSubscriptionOwnerId]", error);
    return null;
  }
  return data?.owner_id ?? null;
}

/** Resolve paid plan tier from Razorpay notes + plan_id fallback. */
export function inferPlanRowFromEntity(
  ent: RzWebhookSubscriptionEntity,
): PlanDb | null {
  const raw = ent?.notes?.plan_code;
  let noteNormalized = "";
  if (typeof raw === "string") noteNormalized = raw.trim().toLowerCase();
  else if (typeof raw === "number")
    noteNormalized = String(raw).trim().toLowerCase();
  if (isSubscribablePlan(noteNormalized)) return noteNormalized as PlanDb;

  if (typeof ent.plan_id === "string" && ent.plan_id) {
    const mapped = planFromRazorpayPlanId(ent.plan_id);
    if (mapped && isSubscribablePlan(mapped)) return mapped as PlanDb;
  }
  return null;
}

/** Apply paid/active subscription tier (calls after paid / activated webhook). */
export async function activatePaidSubscription(
  ent: RzWebhookSubscriptionEntity,
  ownerId: string,
): Promise<boolean> {
  const planTier = inferPlanRowFromEntity(ent);
  if (!planTier || !ownerId || !ent.id) {
    console.error(
      "[activatePaidSubscription] missing plan, owner, or subscription id",
      {
        planTier,
        ownerId: !!ownerId,
        subId: ent.id,
        plan_id: ent.plan_id,
      },
    );
    return false;
  }

  const { data: current } = await supabaseAdmin
    .from("subscriptions")
    .select("status, razorpay_subscription_id")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (
    current?.razorpay_subscription_id === ent.id &&
    ["canceled", "expired"].includes(current.status)
  ) {
    return true;
  }

  const currentEndIso = unixToIso(ent.current_end ?? null);

  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      owner_id: ownerId,
      plan: planTier,
      status: "active",
      razorpay_subscription_id: ent.id,
      razorpay_customer_id: ent.customer_id ?? null,
      current_period_end: currentEndIso,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );
  if (error) console.error("[activatePaidSubscription]", error);
  return !error;
}

/** Razorpay ended / halted / paused — downgrade to Free (Stripe-style SaaS). */
export async function downgradeToFree(
  ent: RzWebhookSubscriptionEntity,
  ownerId: string,
) {
  if (!ownerId) return false;
  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      owner_id: ownerId,
      plan: "free",
      status: "canceled",
      razorpay_subscription_id: ent.id ?? null,
      razorpay_customer_id: ent.customer_id ?? null,
      current_period_end: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );
  if (error) console.error("[downgradeToFree]", error);
  return !error;
}

/** Clear a stuck checkout so the user can start Razorpay again. */
export async function resetCheckoutState(ownerId: string) {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("razorpay_customer_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      owner_id: ownerId,
      plan: "free",
      status: "active",
      razorpay_subscription_id: null,
      razorpay_customer_id: data?.razorpay_customer_id ?? null,
      current_period_end: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );
  if (error) console.error("[resetCheckoutState]", error);
  return !error;
}

/** Immediately after Razorpay `subscriptions` REST create — user still checkout-pending until webhook/sync. */
export async function markCheckoutPending(
  ownerId: string,
  customerId: string,
  razorpaySubId: string,
) {
  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      owner_id: ownerId,
      plan: "free",
      status: "pending_checkout",
      razorpay_customer_id: customerId,
      razorpay_subscription_id: razorpaySubId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );
  if (error) console.error("[markCheckoutPending]", error);
  return !error;
}

export type ReconcileResult = {
  synced: boolean;
  plan: PlanDb;
  status: string;
  razorpay_status: string;
};

/** Pull Razorpay subscription status into Supabase (webhook fallback + billing refresh). */
export async function reconcileSubscriptionWithRazorpay(
  ownerId: string,
  ent: RzWebhookSubscriptionEntity,
): Promise<ReconcileResult> {
  const rzStatus = (ent.status ?? "").toLowerCase();
  const { data: local } = await supabaseAdmin
    .from("subscriptions")
    .select("plan, status")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const fallback: ReconcileResult = {
    synced: false,
    plan: (local?.plan ?? "free") as PlanDb,
    status: local?.status ?? "active",
    razorpay_status: rzStatus,
  };

  if (!ent.id) return fallback;

  if (rzStatus === "active" || rzStatus === "authenticated") {
    const ok = await activatePaidSubscription(ent, ownerId);
    const plan =
      inferPlanRowFromEntity(ent) ?? (local?.plan as PlanDb) ?? "free";
    return {
      synced: ok,
      plan: ok ? plan : ((local?.plan ?? "free") as PlanDb),
      status: ok ? "active" : (local?.status ?? "active"),
      razorpay_status: rzStatus,
    };
  }

  if (rzStatus === "created") {
    const customerId = ent.customer_id ?? "";
    if (customerId) await markCheckoutPending(ownerId, customerId, ent.id);
    return {
      synced: true,
      plan: "free",
      status: "pending_checkout",
      razorpay_status: rzStatus,
    };
  }

  if (
    ["cancelled", "completed", "expired", "halted", "paused"].includes(rzStatus)
  ) {
    if (local?.status && CHECKOUT_STATUSES.has(local.status)) {
      await resetCheckoutState(ownerId);
      return {
        synced: true,
        plan: "free",
        status: "active",
        razorpay_status: rzStatus,
      };
    }
    await downgradeToFree(ent, ownerId);
    return {
      synced: true,
      plan: "free",
      status: "canceled",
      razorpay_status: rzStatus,
    };
  }

  return fallback;
}
