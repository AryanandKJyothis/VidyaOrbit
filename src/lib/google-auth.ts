import { supabase } from "@/integrations/supabase/client";
import { authCallbackUrl } from "@/lib/auth-callback";

/** Redirect the browser to Google via the Supabase Auth provider. */
export async function signInWithGoogle(nextPath: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authCallbackUrl(origin, nextPath),
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });
}
