import { supabase } from "@/integrations/supabase/client";
import { authCallbackUrl } from "@/lib/auth-callback";

/** Redirect the browser to Apple via the Supabase Auth provider. */
export async function signInWithApple(nextPath: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return supabase.auth.signInWithOAuth({
    provider: "apple",
    options: {
      redirectTo: authCallbackUrl(origin, nextPath),
    },
  });
}
