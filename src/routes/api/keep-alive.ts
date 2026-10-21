/**
 * GET /api/keep-alive
 * Cheap daily ping so the free-plan Supabase project does not auto-pause.
 * Returns only { ok: true } or { ok: false } — never row data.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function jsonOk(ok: boolean, status: number) {
  return Response.json(
    { ok },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export const Route = createFileRoute("/api/keep-alive")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (
          secret &&
          request.headers.get("authorization") !== `Bearer ${secret}`
        ) {
          return jsonOk(false, 401);
        }

        try {
          const { error } = await supabaseAdmin
            .from("institutes")
            .select("id", { count: "exact", head: true })
            .limit(1);

          if (error) {
            console.error("[keep-alive]", error.message);
            return jsonOk(false, 500);
          }

          return jsonOk(true, 200);
        } catch (e) {
          console.error("[keep-alive]", e);
          return jsonOk(false, 500);
        }
      },
    },
  },
});
