import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles" as never)
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Failed to verify admin");
  if (!data) throw new Error("Forbidden: admin only");
}

export const checkAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await assertAdmin(context.userId);
      return { admin: true };
    } catch {
      return { admin: false };
    }
  });

export const listInstitutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ search: z.string().max(120).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin.rpc(
      "admin_institute_health_summary" as never,
      { _search: data.search?.trim() || null } as never,
    );
    if (error) throw new Error(error.message);

    return (
      (rows ?? []) as Array<{
        owner_id: string;
        name: string;
        contact_email: string | null;
        member_emails: string[] | null;
        plan: string | null;
        status: string | null;
        start_date: string | null;
        expiry_date: string | null;
        plan_price: number | null;
        student_count: number | string | null;
        plan_limit: number | null;
        days_until_expiry: number | null;
        last_active_at: string | null;
        last_active_source: string | null;
        attendance_30d: number | string | null;
        payments_30d: number | string | null;
        students_30d: number | string | null;
        batches_30d: number | string | null;
        top_feature_30d: string | null;
      }>
    ).map((row) => ({
      owner_id: row.owner_id,
      name: row.name,
      contact_email: row.contact_email,
      member_emails: (row.member_emails ?? []).filter(
        (e): e is string => typeof e === "string" && e.length > 0,
      ),

      sub: row.plan
        ? {
            owner_id: row.owner_id,
            plan: row.plan,
            status: row.status ?? "active",
            start_date: row.start_date,
            expiry_date: row.expiry_date,
            plan_price: row.plan_price,
          }
        : null,
      student_count: Number(row.student_count ?? 0),
      plan_limit: row.plan_limit ?? 25,
      days_until_expiry: row.days_until_expiry,
      last_active_at:
        row.last_active_at && new Date(row.last_active_at).getTime() > 0
          ? row.last_active_at
          : null,
      last_active_source: row.last_active_source,
      attendance_30d: Number(row.attendance_30d ?? 0),
      payments_30d: Number(row.payments_30d ?? 0),
      students_30d: Number(row.students_30d ?? 0),
      batches_30d: Number(row.batches_30d ?? 0),
      top_feature_30d: row.top_feature_30d,
    }));
  });

export const getInstituteHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ owner_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin.rpc(
      "admin_institute_health_detail" as never,
      { _owner: data.owner_id } as never,
    );
    if (error) throw new Error(error.message);
    return row as Record<string, number | string | null>;
  });

export const getSubscriptionDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ owner_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const [{ data: sub }, { data: inst }, { data: audit }, { data: reviews }] =
      await Promise.all([
        supabaseAdmin
          .from("subscriptions")
          .select("*")
          .eq("owner_id", data.owner_id)
          .maybeSingle(),
        supabaseAdmin
          .from("institutes")
          .select("name, contact_email, admin_notes" as never)
          .eq("owner_id", data.owner_id)
          .maybeSingle(),
        supabaseAdmin
          .from("subscription_audit" as never)
          .select("*")
          .eq("owner_id", data.owner_id)
          .order("changed_at", { ascending: false })
          .limit(25),
        supabaseAdmin
          .from("billing_orders")
          .select(
            "id, tier, cycle, amount_paise, currency, razorpay_order_id, razorpay_payment_id, paid_at, needs_review, review_reason",
          )
          .eq("owner_id", data.owner_id)
          .eq("needs_review", true)
          .order("paid_at", { ascending: false }),
      ]);
    return { sub, inst, audit: audit ?? [], reviews: reviews ?? [] };
  });

const planEnum = z.enum(["free", "starter", "growth", "pro"]);
const statusEnum = z.enum([
  "active",
  "trialing",
  "past_due",
  "canceled",
  "pending_checkout",
]);

type ApplyResult =
  | {
      ok: true;
      plan: string;
      status: string;
      expiry_date: string | null;
      student_count: number;
      limit: number;
      over_limit: boolean;
    }
  | {
      requires_confirmation: true;
      student_count: number;
      new_limit: number;
      over_by: number;
      new_plan: string;
    };

async function applyChange(args: {
  owner_id: string;
  changed_by: string;
  plan: string;
  status: string;
  start_date: string | null;
  expiry_date: string | null;
  plan_price: number | null;
  notes: string | null;
  note: string;
  confirm: boolean;
}): Promise<ApplyResult> {
  const { data, error } = await supabaseAdmin.rpc(
    "apply_subscription_change" as never,
    {
      _owner: args.owner_id,
      _changed_by: args.changed_by,
      _plan: args.plan,
      _status: args.status,
      _start: args.start_date,
      _expiry: args.expiry_date,
      _price: args.plan_price,
      _notes: args.notes,
      _note: args.note,
      _confirm: args.confirm,
    } as never,
  );
  if (error) throw new Error(error.message);
  return data as unknown as ApplyResult;
}

export const updateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        owner_id: z.string().uuid(),
        plan: planEnum,
        status: statusEnum,
        start_date: z.string().nullable(),
        expiry_date: z.string().nullable(),
        plan_price: z.number().nullable(),
        notes: z.string().max(2000).nullable(),
        note: z.string().max(500).optional(),
        confirm: z.boolean().optional(),
        setup_fee_paid: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const result = await applyChange({
      owner_id: data.owner_id,
      changed_by: context.userId,
      plan: data.plan,
      status: data.status,
      start_date: data.start_date,
      expiry_date: data.expiry_date,
      plan_price: data.plan_price,
      notes: data.notes,
      note: data.note ?? "Manual update",
      confirm: data.confirm ?? false,
    });
    if (typeof data.setup_fee_paid === "boolean") {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({ setup_fee_paid: data.setup_fee_paid })
        .eq("owner_id", data.owner_id);
      if (error) throw new Error(error.message);
    }
    return result;
  });

export const dismissBillingReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ owner_id: z.string().uuid(), order_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("billing_orders")
      .update({ needs_review: false })
      .eq("id", data.order_id)
      .eq("owner_id", data.owner_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const extendSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        owner_id: z.string().uuid(),
        days: z.number().int().min(1).max(3650),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: before } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, status, start_date, expiry_date, plan_price, notes")
      .eq("owner_id", data.owner_id)
      .maybeSingle();
    const base =
      before?.expiry_date && new Date(before.expiry_date) > new Date()
        ? new Date(before.expiry_date)
        : new Date();
    const newExpiry = new Date(
      base.getTime() + data.days * 86400_000,
    ).toISOString();
    const res = await applyChange({
      owner_id: data.owner_id,
      changed_by: context.userId,
      plan: (before?.plan as string) ?? "free",
      status: "active",
      start_date: (before?.start_date as string) ?? new Date().toISOString(),
      expiry_date: newExpiry,
      plan_price: (before?.plan_price as number | null) ?? null,
      notes: (before?.notes as string | null) ?? null,
      note: `Extended by ${data.days} days`,
      confirm: true, // extending an existing plan never lowers limit
    });
    return { ok: true, result: res, expiry_date: newExpiry };
  });

export const grantTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        owner_id: z.string().uuid(),
        days: z.number().int().min(1).max(365),
        plan: planEnum.optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: before } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, plan_price, notes")
      .eq("owner_id", data.owner_id)
      .maybeSingle();
    const plan = data.plan ?? (before?.plan as string) ?? "starter";
    const start = new Date();
    const expiry = new Date(
      start.getTime() + data.days * 86400_000,
    ).toISOString();
    return applyChange({
      owner_id: data.owner_id,
      changed_by: context.userId,
      plan,
      status: "trialing",
      start_date: start.toISOString(),
      expiry_date: expiry,
      plan_price: (before?.plan_price as number | null) ?? null,
      notes: (before?.notes as string | null) ?? null,
      note: `Granted ${data.days}-day trial`,
      confirm: true,
    });
  });

export const updateInstituteAdminNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        owner_id: z.string().uuid(),
        admin_notes: z.string().max(5000).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("institutes")
      .update({ admin_notes: data.admin_notes } as never)
      .eq("owner_id", data.owner_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
