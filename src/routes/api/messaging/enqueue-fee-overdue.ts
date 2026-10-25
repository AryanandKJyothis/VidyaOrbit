/**
 * POST /api/messaging/enqueue-fee-overdue
 * "Remind overdue" on Fees → fee_overdue outbox rows.
 * Only balance > 0 and a due date already passed. Deduped one per student
 * per N days (default 3). Assisted wa.me is the send path.
 * Requires fees:write to queue; send is messages:write via /api/messaging/mark-sent.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseBearerUserId } from "@/server/require-bearer-user";
import { assertFeesWrite } from "@/server/messaging-access";
import { allowRequest, clientAddress, tooManyRequests } from "@/lib/rate-limit";
import { todayISO } from "@/lib/format";
import { planFeeOverdueOutbox, settingsFromRow } from "@/lib/messaging/policy";
import { summarizeOutboxRows } from "@/lib/messaging/summarize";
import type {
  FeeBalanceStudent,
  ExistingFeeOverdueRow,
} from "@/lib/messaging/policy";
import type { MessageOutboxRow } from "@/lib/messaging/types";

const bodySchema = z.object({
  ownerId: z.string().uuid(),
  studentIds: z.array(z.string().uuid()).optional(),
});

function migrationMissing(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    /message_outbox|institute_messaging_settings|does not exist/i.test(
      error.message ?? "",
    )
  );
}

export const Route = createFileRoute("/api/messaging/enqueue-fee-overdue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (
          !allowRequest(`msg-fee-overdue:${clientAddress(request)}`, 30, 60_000)
        ) {
          return tooManyRequests();
        }

        const auth = await parseBearerUserId(request);
        if (!auth.ok) return auth.response;

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return Response.json(
            { ok: false, code: "BAD_REQUEST", message: "Invalid request." },
            { status: 400 },
          );
        }

        try {
          const forbidden = await assertFeesWrite(body.ownerId, auth.userId);
          if (forbidden) return forbidden;

          const requestedIds = body.studentIds?.length
            ? [...new Set(body.studentIds)]
            : null;

          let studentQuery = supabaseAdmin
            .from("students")
            .select(
              "id, full_name, guardian_phone, phone, fee_total, fee_due_date, status",
            )
            .eq("owner_id", body.ownerId);
          if (requestedIds) {
            studentQuery = studentQuery.in("id", requestedIds);
          }
          const { data: studentRows, error: studentErr } = await studentQuery;
          if (studentErr) throw studentErr;

          const studentIds = (studentRows ?? []).map((s) => s.id);
          const paidByStudent: Record<string, number> = {};
          if (studentIds.length > 0) {
            const paidRes = await supabaseAdmin
              .from("fee_payments")
              .select("student_id, amount")
              .eq("owner_id", body.ownerId)
              .in("student_id", studentIds);
            if (paidRes.error) throw paidRes.error;
            for (const row of paidRes.data ?? []) {
              paidByStudent[row.student_id] =
                (paidByStudent[row.student_id] ?? 0) + Number(row.amount ?? 0);
            }
          }

          const { data: institute } = await supabaseAdmin
            .from("institutes")
            .select("name")
            .eq("owner_id", body.ownerId)
            .maybeSingle();

          let settingsRes = await supabaseAdmin
            .from("institute_messaging_settings")
            .select("wa_auto, locale, fee_overdue_dedupe_days")
            .eq("owner_id", body.ownerId)
            .maybeSingle();
          if (
            settingsRes.error &&
            /fee_overdue_dedupe_days/i.test(settingsRes.error.message ?? "")
          ) {
            settingsRes = await supabaseAdmin
              .from("institute_messaging_settings")
              .select("wa_auto, locale")
              .eq("owner_id", body.ownerId)
              .maybeSingle();
          }
          if (migrationMissing(settingsRes.error)) {
            return Response.json(
              {
                ok: false,
                code: "MIGRATION_REQUIRED",
                message:
                  "Parent messaging tables are not applied yet. An operator must apply the migration.",
              },
              { status: 503 },
            );
          }
          const settings = settingsFromRow(
            settingsRes.data as {
              wa_auto?: boolean;
              locale?: string;
              fee_overdue_dedupe_days?: number;
            } | null,
          );

          const existingRes =
            studentIds.length === 0
              ? { data: [], error: null }
              : await supabaseAdmin
                  .from("message_outbox")
                  .select(
                    "student_id, dedupe_key, status, created_at, sent_at, skip_reason",
                  )
                  .eq("owner_id", body.ownerId)
                  .eq("kind", "fee_overdue")
                  .in("student_id", studentIds);
          if (migrationMissing(existingRes.error)) {
            return Response.json(
              {
                ok: false,
                code: "MIGRATION_REQUIRED",
                message:
                  "Parent messaging tables are not applied yet. An operator must apply the migration.",
              },
              { status: 503 },
            );
          }
          if (existingRes.error) throw existingRes.error;

          const students: FeeBalanceStudent[] = (studentRows ?? []).map(
            (s) => ({
              id: s.id,
              fullName: s.full_name ?? "your child",
              feeTotal: Number(s.fee_total ?? 0),
              paidTotal: paidByStudent[s.id] ?? 0,
              feeDueDate: s.fee_due_date,
              status: s.status,
              guardianPhone: s.guardian_phone,
              studentPhone: s.phone,
            }),
          );

          const plan = planFeeOverdueOutbox({
            students,
            requestedIds,
            existing: (existingRes.data ?? []) as ExistingFeeOverdueRow[],
            centreName: institute?.name ?? "the centre",
            locale: settings.locale,
            today: todayISO(),
            dedupeDays: settings.feeOverdueDedupeDays,
          });

          if (plan.inserts.length > 0) {
            const { error: insertErr } = await supabaseAdmin
              .from("message_outbox")
              .upsert(
                plan.inserts.map((row) => ({
                  owner_id: body.ownerId,
                  student_id: row.studentId,
                  session_id: null,
                  session_date: todayISO(),
                  kind: row.kind,
                  phone: row.phone,
                  body: row.body,
                  status: row.status,
                  skip_reason: row.skipReason,
                  dedupe_key: row.dedupeKey,
                  created_by: auth.userId,
                  payload: row.payload,
                })),
                { onConflict: "owner_id,dedupe_key", ignoreDuplicates: true },
              );
            if (insertErr) throw insertErr;
          }

          const afterIds = [
            ...new Set([
              ...plan.inserts.map((row) => row.dedupeKey),
              ...((existingRes.data ?? []) as ExistingFeeOverdueRow[]).map(
                (row) => row.dedupe_key,
              ),
            ]),
          ];
          const after =
            afterIds.length === 0
              ? { data: [], error: null }
              : await supabaseAdmin
                  .from("message_outbox")
                  .select("status, skip_reason")
                  .eq("owner_id", body.ownerId)
                  .eq("kind", "fee_overdue")
                  .in("dedupe_key", afterIds);
          if (after.error) throw after.error;

          const summary = summarizeOutboxRows(
            (after.data ?? []) as Pick<
              MessageOutboxRow,
              "status" | "skip_reason"
            >[],
          );
          summary.already = plan.already;

          return Response.json({
            ok: true,
            summary,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("[enqueue-fee-overdue]", message);
          if (migrationMissing({ message })) {
            return Response.json(
              {
                ok: false,
                code: "MIGRATION_REQUIRED",
                message:
                  "Parent messaging tables are not applied yet. An operator must apply the migration.",
              },
              { status: 503 },
            );
          }
          return Response.json(
            {
              ok: false,
              code: "DB_ERROR",
              message: "Could not queue overdue reminders.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
