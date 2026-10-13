import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { signOutAndClearCache } from "@/lib/sign-out";

/** Signs out, clears the query cache, and lands on /login unless `redirectTo` is null. */
export function useSignOut(options?: { redirectTo?: "/login" | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const redirectTo =
    options?.redirectTo === undefined ? "/login" : options.redirectTo;

  return async () => {
    const { ok } = await signOutAndClearCache({
      signOut: () => supabase.auth.signOut(),
      clearCache: () => qc.clear(),
    });
    if (!ok) {
      toast.error("Could not sign out. Please try again.");
      return false;
    }
    if (redirectTo) {
      await navigate({ to: redirectTo });
    }
    return true;
  };
}
