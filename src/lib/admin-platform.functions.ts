import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin-assert";
import {
  mapAlert,
  mapCentreRow,
  mapOverview,
  mapPaged,
  mapPaymentRow,
  mapUserRow,
  stripForbiddenAdminFields,
  type AdminAlert,
  type AdminCentreRow,
  type AdminOverview,
  type AdminPaged,
  type AdminPaymentRow,
  type AdminUserRow,
} from "@/lib/admin-mrr";

const searchSchema = z.object({
  search: z.string().max(120).optional(),
  filter: z.string().max(40).optional(),
  sort: z.string().max(40).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).max(100_000).optional(),
});

async function rpcJson(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  return data as unknown;
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    await assertAdmin(context.userId);
    const data = await rpcJson("admin_platform_overview", {});
    return mapOverview(data);
  });

export const listAdminCentres = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => searchSchema.parse(i))
  .handler(async ({ data, context }): Promise<AdminPaged<AdminCentreRow>> => {
    await assertAdmin(context.userId);
    const rows = await rpcJson("admin_centres_list", {
      _search: data.search?.trim() || null,
      _filter: data.filter || "all",
      _sort: data.sort || "name",
      _limit: data.limit ?? 50,
      _offset: data.offset ?? 0,
    });
    return mapPaged(rows, mapCentreRow);
  });

export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => searchSchema.parse(i))
  .handler(async ({ data, context }): Promise<AdminPaged<AdminUserRow>> => {
    await assertAdmin(context.userId);
    const rows = await rpcJson("admin_users_list", {
      _search: data.search?.trim() || null,
      _filter: data.filter || "all",
      _limit: data.limit ?? 50,
      _offset: data.offset ?? 0,
    });
    return mapPaged(rows, mapUserRow);
  });

export const getAdminUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const raw = await rpcJson("admin_user_detail", { _user: data.user_id });
    if (!raw || typeof raw !== "object") return { user: null };
    const body = raw as Record<string, unknown>;
    return {
      user: mapUserRow({
        ...((body.user as Record<string, unknown> | null) ?? {}),
        centres: body.centres,
      }),
      centres: Array.isArray(body.centres) ? body.centres : [],
      subscription: body.subscription ?? null,
      institute: body.institute ?? null,
      payments: Array.isArray(body.payments)
        ? body.payments
            .map(mapPaymentRow)
            .filter((p): p is AdminPaymentRow => !!p)
        : [],
      invites: Array.isArray(body.invites)
        ? body.invites.map((row) =>
            row && typeof row === "object"
              ? stripForbiddenAdminFields(row as Record<string, unknown>)
              : row,
          )
        : [],
    };
  });

export const listAdminPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => searchSchema.parse(i))
  .handler(async ({ data, context }): Promise<AdminPaged<AdminPaymentRow>> => {
    await assertAdmin(context.userId);
    const rows = await rpcJson("admin_payments_list", {
      _search: data.search?.trim() || null,
      _filter: data.filter || "all",
      _limit: data.limit ?? 50,
      _offset: data.offset ?? 0,
    });
    return mapPaged(rows, mapPaymentRow);
  });

export const listAdminAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAlert[]> => {
    await assertAdmin(context.userId);
    const data = await rpcJson("admin_alerts", {});
    if (!Array.isArray(data)) return [];
    return data.map(mapAlert).filter((a): a is AdminAlert => !!a);
  });
