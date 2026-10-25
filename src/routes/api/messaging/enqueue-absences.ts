/**
 * POST /api/messaging/enqueue-absences
 * Attendance save → one absence outbox row per student per session.
 * Deduped. Late is ignored. Assisted wa.me is the send path.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseBearerUserId } from "@/server/require-bearer-user";
import { assertAttendanceWrite } from "@/server/messaging-access";
import { allowRequest, clientAddress, tooManyRequests } from "@/lib/rate-limit";
import { resolveParentWhatsAppPhone } from "@/lib/messaging/phone";
import { planAbsenceOutbox, settingsFromRow } from "@/lib/messaging/policy";
import { summarizeOutboxRows } from "@/lib/messaging/summarize";
import type { MessageOutboxRow } from "@/lib/messaging/types";

const bodySchema = z.object({
  ownerId: z.string().uuid(),
  sessionId: z.string().uuid(),
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

export const Route = createFileRoute("/api/messaging/enqueue-absences")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (
          !allowRequest(`msg-enqueue:${clientAddress(request)}`, 30, 60_000)
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
          const forbidden = await assertAttendanceWrite(
            body.ownerId,
            auth.userId,
          );
          if (forbidden) return forbidden;

          const { data: session, error: sessionErr } = await supabaseAdmin
            .from("attendance_sessions")
            .select("id, owner_id, batch_id, session_date")
            .eq("id", body.sessionId)
            .eq("owner_id", body.ownerId)
            .maybeSingle();
          if (sessionErr) throw sessionErr;
          if (!session) {
            return Response.json(
              {
                ok: false,
                code: "NOT_FOUND",
                message: "Attendance session not found.",
              },
              { status: 404 },
            );
          }

          const { data: records, error: recErr } = await supabaseAdmin
            .from("attendance_records")
            .select("student_id, status")
            .eq("session_id", session.id)
            .eq("owner_id", body.ownerId);
          if (recErr) throw recErr;

          const studentIds = [
            ...new Set((records ?? []).map((r) => r.student_id)),
          ];
          const students =
            studentIds.length === 0
              ? []
              : ((
                  await supabaseAdmin
                    .from("students")
                    .select("id, full_name, guardian_phone, phone, status")
                    .eq("owner_id", body.ownerId)
                    .in("id", studentIds)
                ).data ?? []);

          const { data: batch } = await supabaseAdmin
            .from("batches")
            .select("name")
            .eq("id", session.batch_id)
            .eq("owner_id", body.ownerId)
            .maybeSingle();

          const { data: institute } = await supabaseAdmin
            .from("institutes")
            .select("name")
            .eq("owner_id", body.ownerId)
            .maybeSingle();

          const settingsRes = await supabaseAdmin
            .from("institute_messaging_settings")
            .select("wa_auto, locale")
            .eq("owner_id", body.ownerId)
            .maybeSingle();
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
          if (settingsRes.error && settingsRes.error.code !== "PGRST116") {
            // PGRST116 = no rows; maybeSingle already handles that
            if (settingsRes.error.code !== "42P01") {
              /* continue with defaults when the row is missing */
            }
          }

          const settings = settingsFromRow(
            settingsRes.data as { wa_auto?: boolean; locale?: string } | null,
          );

          const existingRes = await supabaseAdmin
            .from("message_outbox")
            .select("id, dedupe_key, status, skip_reason")
            .eq("owner_id", body.ownerId)
            .eq("kind", "absence")
            .eq("session_id", session.id);
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

          const existing = (existingRes.data ?? []) as Pick<
            MessageOutboxRow,
            "dedupe_key" | "status" | "skip_reason"
          >[];

          const studentById = new Map(students.map((s) => [s.id, s]));
          const plan = planAbsenceOutbox({
            sessionId: session.id,
            sessionDate: session.session_date,
            batchName: batch?.name ?? "class",
            centreName: institute?.name ?? "the centre",
            locale: settings.locale,
            marks: (records ?? []).map((rec) => {
              const student = studentById.get(rec.student_id);
              return {
                studentId: rec.student_id,
                status: rec.status,
                studentName: student?.full_name ?? "your child",
                guardianPhone: student?.guardian_phone,
                studentPhone: student?.phone,
                phone: resolveParentWhatsAppPhone({
                  guardian_phone: student?.guardian_phone,
                  phone: student?.phone,
                }),
              };
            }),
            existing,
          });

          if (plan.skipDedupeKeys.length > 0) {
            const { error: skipErr } = await supabaseAdmin
              .from("message_outbox")
              .update({
                status: "skipped",
                skip_reason: "not_absent",
              })
              .eq("owner_id", body.ownerId)
              .eq("status", "queued")
              .in("dedupe_key", plan.skipDedupeKeys);
            if (skipErr) throw skipErr;
          }

          if (plan.inserts.length > 0) {
            const { error: insertErr } = await supabaseAdmin
              .from("message_outbox")
              .upsert(
                plan.inserts.map((row) => ({
                  owner_id: body.ownerId,
                  student_id: row.studentId,
                  session_id: row.sessionId,
                  session_date: row.sessionDate,
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

          const after = await supabaseAdmin
            .from("message_outbox")
            .select("status, skip_reason")
            .eq("owner_id", body.ownerId)
            .eq("kind", "absence")
            .eq("session_id", session.id);
          if (after.error) throw after.error;

          return Response.json({
            ok: true,
            summary: summarizeOutboxRows(
              (after.data ?? []) as Pick<
                MessageOutboxRow,
                "status" | "skip_reason"
              >[],
            ),
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("[enqueue-absences]", message);
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
              message: "Could not queue parent alerts.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
