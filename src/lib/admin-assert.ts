import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Platform admin check. Call only from server fns after requireSupabaseAuth. */
export async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles" as never)
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Failed to verify admin");
  if (!data) throw new Error("Forbidden: admin only");
}
