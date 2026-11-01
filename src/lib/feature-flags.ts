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

/**
 * Onboarding v2 quick start (4 one-tap questions → batches → names → first
 * attendance). Default ON; set VITE_ONBOARDING_V2="false" to fall back to the
 * legacy owner wizard. Only shown to owners whose workspace has no batches and
 * no students, so existing centres are unaffected.
 */
export function isOnboardingV2Enabled(
  value: unknown = import.meta.env.VITE_ONBOARDING_V2,
): boolean {
  return value !== "false";
}

export const ONBOARDING_V2_ENABLED = isOnboardingV2Enabled();

/**
 * Sample-data toggle needs migration 20261101090000_add_is_sample.sql applied.
 * Default OFF; only the exact string "true" shows the toggle.
 */
export function isSampleDataEnabled(
  value: unknown = import.meta.env.VITE_ONBOARDING_SAMPLE_DATA,
): boolean {
  return value === "true";
}

export const SAMPLE_DATA_ENABLED = isSampleDataEnabled();
