/**
 * POST /api/messaging/enqueue-fee-paid
 * Payment recorded (manual mark-paid or a writer that inserted fee_payments)
 * → one fee_paid outbox row. Deduped on payment_id so webhook replay is a no-op.
 * Assisted wa.me is the send path. Requires fees:write to queue; send is
 * messages:write via /api/messaging/mark-sent.
 */
import { randomBytes } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseBearerUserId } from "@/server/require-bearer-user";
import { assertFeesWrite } from "@/server/messaging-access";
import { allowRequest, clientAddress, tooManyRequests } from "@/lib/rate-limit";
import { resolveParentWhatsAppPhone } from "@/lib/messaging/phone";
import {
  feePaidDedupeKey,
  planFeePaidOutbox,
  settingsFromRow,
} from "@/lib/messaging/policy";
import { summarizeOutboxRows } from "@/lib/messaging/summarize";
import type { MessageOutboxRow } from "@/lib/messaging/types";

const bodySchema = z.object({
  ownerId: z.string().uuid(),
  paymentId: z.string().uuid(),
});

function migrationMissing(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    /message_outbox|institute_messaging_settings|receipt_shares|does not exist/i.test(
      error.message ?? "",
    )
  );
}

function mintShareToken(): string {
  return randomBytes(24).toString("hex");
}

export const Route = createFileRoute("/api/messaging/enqueue-fee-paid")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (
          !allowRequest(`msg-fee-paid:${clientAddress(request)}`, 30, 60_000)
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

          const { data: payment, error: payErr } = await supabaseAdmin
            .from("fee_payments")
            .select(
              "id, owner_id, student_id, amount, payment_date, receipt_number",
            )
            .eq("id", body.paymentId)
            .eq("owner_id", body.ownerId)
            .maybeSingle();
          if (payErr) throw payErr;
          if (!payment) {
            return Response.json(
              { ok: false, code: "NOT_FOUND", message: "Payment not found." },
              { status: 404 },
            );
          }

          const { data: student, error: studentErr } = await supabaseAdmin
            .from("students")
            .select("id, full_name, guardian_phone, phone, fee_total")
            .eq("id", payment.student_id)
            .eq("owner_id", body.ownerId)
            .maybeSingle();
          if (studentErr) throw studentErr;
          if (!student) {
            return Response.json(
              { ok: false, code: "NOT_FOUND", message: "Student not found." },
              { status: 404 },
            );
          }

          const paidRes = await supabaseAdmin
            .from("fee_payments")
            .select("amount")
            .eq("owner_id", body.ownerId)
            .eq("student_id", payment.student_id);
          if (paidRes.error) throw paidRes.error;
          const paidTotal = (paidRes.data ?? []).reduce(
            (sum, row) => sum + Number(row.amount ?? 0),
            0,
          );

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

          const settings = settingsFromRow(
            settingsRes.data as { wa_auto?: boolean; locale?: string } | null,
          );

          let share = await supabaseAdmin
            .from("receipt_shares")
            .select("share_token, revoked_at")
            .eq("payment_id", payment.id)
            .maybeSingle();
          if (migrationMissing(share.error)) {
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
          if (share.error && share.error.code !== "PGRST116") {
            throw share.error;
          }
          if (!share.data?.share_token) {
            const token = mintShareToken();
            const inserted = await supabaseAdmin
              .from("receipt_shares")
              .upsert(
                {
                  payment_id: payment.id,
                  owner_id: body.ownerId,
                  share_token: token,
                },
                { onConflict: "payment_id", ignoreDuplicates: true },
              )
              .select("share_token, revoked_at")
              .maybeSingle();
            if (inserted.error) throw inserted.error;
            share = inserted;
          }
          const shareToken = share.data?.share_token;
          if (!shareToken) {
            return Response.json(
              {
                ok: false,
                code: "NO_RECEIPT_LINK",
                message: "Could not create a public receipt link.",
              },
              { status: 500 },
            );
          }

          const existingRes = await supabaseAdmin
            .from("message_outbox")
            .select("id, dedupe_key, status, skip_reason")
            .eq("owner_id", body.ownerId)
            .eq("kind", "fee_paid")
            .eq("dedupe_key", feePaidDedupeKey(payment.id));
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

          const plan = planFeePaidOutbox({
            paymentId: payment.id,
            studentId: payment.student_id,
            studentName: student.full_name ?? "your child",
            amount: Number(payment.amount),
            paymentDate: payment.payment_date,
            receiptNumber: payment.receipt_number,
            shareToken,
            feeTotal: Number(student.fee_total ?? 0),
            paidTotal,
            locale: settings.locale,
            phone: resolveParentWhatsAppPhone({
              guardian_phone: student.guardian_phone,
              phone: student.phone,
            }),
            existing,
          });

          if (plan.insert) {
            const { error: insertErr } = await supabaseAdmin
              .from("message_outbox")
              .upsert(
                {
                  owner_id: body.ownerId,
                  student_id: plan.insert.studentId,
                  session_id: null,
                  session_date: payment.payment_date,
                  kind: plan.insert.kind,
                  phone: plan.insert.phone,
                  body: plan.insert.body,
                  status: plan.insert.status,
                  skip_reason: plan.insert.skipReason,
                  dedupe_key: plan.insert.dedupeKey,
                  created_by: auth.userId,
                  payload: plan.insert.payload,
                },
                { onConflict: "owner_id,dedupe_key", ignoreDuplicates: true },
              );
            if (insertErr) throw insertErr;
          }

          const after = await supabaseAdmin
            .from("message_outbox")
            .select("status, skip_reason")
            .eq("owner_id", body.ownerId)
            .eq("kind", "fee_paid")
            .eq("dedupe_key", feePaidDedupeKey(payment.id));
          if (after.error) throw after.error;

          const summary = summarizeOutboxRows(
            (after.data ?? []) as Pick<
              MessageOutboxRow,
              "status" | "skip_reason"
            >[],
          );
          if (plan.already) summary.already = 1;

          return Response.json({
            ok: true,
            summary,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("[enqueue-fee-paid]", message);
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
              message: "Could not queue the receipt acknowledgement.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
