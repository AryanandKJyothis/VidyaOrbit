/**
 * POST /api/messaging/process-auto
 * Tier 2 cron stub. Only centres with wa_auto=true are considered.
 * Assisted wa.me remains the main path. Never marks sent without a
 * live provider ack.
 *
 * Vercel Hobby allows one cron run per day. vercel.json schedules this at
 * 04:20 UTC (`20 4 * * *`). Hourly (`20 * * * *`) needs Pro and can return
 * when a centre actually turns wa_auto on.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createWhatsAppWorker,
  dispatchAutoSend,
  readWhatsAppWorkerConfig,
} from "@/lib/messaging/worker";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/messaging/process-auto")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ ok: false, code: "UNAUTHORIZED" }, 401);
  }

  try {
    const settingsRes = await supabaseAdmin
      .from("institute_messaging_settings")
      .select("owner_id, wa_auto")
      .eq("wa_auto", true);
    if (settingsRes.error) throw settingsRes.error;

    const ownerIds = (settingsRes.data ?? []).map((row) => row.owner_id);
    if (ownerIds.length === 0) {
      return json({
        ok: true,
        processed: 0,
        sent: 0,
        skipped: 0,
        note: "wa_auto is off for every centre. Assisted send is the main path.",
      });
    }

    const queuedRes = await supabaseAdmin
      .from("message_outbox")
      .select("id, owner_id, phone, body, kind, status")
      .eq("status", "queued")
      .in("owner_id", ownerIds)
      .limit(50);
    if (queuedRes.error) throw queuedRes.error;

    const worker = createWhatsAppWorker(readWhatsAppWorkerConfig());
    let sent = 0;
    let skipped = 0;
    for (const row of queuedRes.data ?? []) {
      const result = await dispatchAutoSend({
        waAuto: true,
        row: {
          id: row.id,
          phone: row.phone,
          body: row.body,
          kind: row.kind,
        },
        worker,
      });
      if (result.ok) {
        await supabaseAdmin
          .from("message_outbox")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            sent_via: "worker",
          })
          .eq("id", row.id)
          .eq("status", "queued");
        sent += 1;
      } else {
        skipped += 1;
        if (result.code === "SEND_FAILED") {
          await supabaseAdmin
            .from("message_outbox")
            .update({
              status: "failed",
              skip_reason: result.message,
            })
            .eq("id", row.id)
            .eq("status", "queued");
        }
        // NOT_CONFIGURED: leave queued so staff can still assisted-send.
      }
    }

    return json({
      ok: true,
      processed: (queuedRes.data ?? []).length,
      sent,
      skipped,
    });
  } catch (e) {
    console.error("[process-auto]", e);
    return json({ ok: false, code: "DB_ERROR" }, 500);
  }
}
