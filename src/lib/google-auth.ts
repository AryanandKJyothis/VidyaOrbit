import { supabase } from "@/integrations/supabase/client";

/** Redirect the browser to Google via the Supabase Auth provider. */
export async function signInWithGoogle(redirectTo: string) {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });
}
