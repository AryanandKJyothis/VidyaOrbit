/**
 * POST /api/messaging/mark-sent
 * Staff tap on a queued row: requires messages:write. Returns the wa.me href
 * and marks the row sent (assisted path). Never claims a Meta API send.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseBearerUserId } from "@/server/require-bearer-user";
import { assertMessagesWrite } from "@/server/messaging-access";
import { allowRequest, clientAddress, tooManyRequests } from "@/lib/rate-limit";
import { canMarkOutboxSent } from "@/lib/messaging/policy";
import { buildAssistedWhatsAppHref } from "@/lib/messaging/wa-me";
import type { OutboxStatus } from "@/lib/messaging/types";

const bodySchema = z.object({
  ownerId: z.string().uuid(),
  outboxId: z.string().uuid(),
});

export const Route = createFileRoute("/api/messaging/mark-sent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!allowRequest(`msg-sent:${clientAddress(request)}`, 60, 60_000)) {
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
          const forbidden = await assertMessagesWrite(body.ownerId, auth.userId);
          if (forbidden) return forbidden;

          const { data: row, error } = await supabaseAdmin
            .from("message_outbox")
            .select("id, owner_id, phone, body, status")
            .eq("id", body.outboxId)
            .eq("owner_id", body.ownerId)
            .maybeSingle();
          if (error) throw error;
          if (!row) {
            return Response.json(
              { ok: false, code: "NOT_FOUND", message: "Message not found." },
              { status: 404 },
            );
          }
          if (!canMarkOutboxSent(row.status as OutboxStatus)) {
            return Response.json(
              {
                ok: false,
                code: "ALREADY_PROCESSED",
                message: "This message is no longer waiting to send.",
                href: buildAssistedWhatsAppHref(row.phone, row.body),
              },
              { status: 409 },
            );
          }

          const href = buildAssistedWhatsAppHref(row.phone, row.body);
          if (!href) {
            await supabaseAdmin
              .from("message_outbox")
              .update({
                status: "skipped",
                skip_reason: "no_phone",
              })
              .eq("id", row.id)
              .eq("owner_id", body.ownerId)
              .eq("status", row.status);
            return Response.json(
              {
                ok: false,
                code: "NO_PHONE",
                message: "Add a parent phone for this student first.",
              },
              { status: 422 },
            );
          }

          const { error: updErr } = await supabaseAdmin
            .from("message_outbox")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              sent_via: "wa_me",
            })
            .eq("id", row.id)
            .eq("owner_id", body.ownerId)
            .eq("status", row.status);
          if (updErr) throw updErr;

          return Response.json({ ok: true, href });
        } catch (e) {
          console.error("[mark-sent]", e);
          return Response.json(
            {
              ok: false,
              code: "DB_ERROR",
              message: "Could not mark the message sent.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
