/**
 * Google OAuth is wired through supabase.auth.signInWithOAuth({ provider: "google" })
 * on login and signup. Keep this off until Authentication → Providers → Google
 * is enabled on the Supabase project. Only the exact string "true" shows the
 * Continue with Google buttons.
 */
export function isGoogleAuthEnabled(
  value: unknown = import.meta.env.VITE_GOOGLE_AUTH_ENABLED,
): boolean {
  return value === "true";
}

export const GOOGLE_AUTH_ENABLED = isGoogleAuthEnabled();
