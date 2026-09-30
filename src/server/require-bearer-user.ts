/**
 * Bearer JWT auth for server-side API routes (duplicates middleware checks from Lovable codegen).
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Returns user id or HTTP error response ready to return from a route handler. */
export async function parseBearerUserId(
  request: Request,
): Promise<{ ok: true; userId: string } | { ok: false; response: Response }> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return {
      ok: false,
      response: Response.json(
        { error: "SUPABASE_SERVER_CONFIG" },
        { status: 500 },
      ),
    };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: Response.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return {
      ok: false,
      response: Response.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  const supabase = createClient<Database>(
    SUPABASE_URL!,
    SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return {
      ok: false,
      response: Response.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }
  return { ok: true, userId: data.claims.sub };
}
