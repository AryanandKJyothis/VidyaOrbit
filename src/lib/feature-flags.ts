/**
 * Online Razorpay checkout stays off until RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
 * RAZORPAY_WEBHOOK_SECRET, and the three plan ids are set on the server.
 * The in-app /plan page remains available.
 */
export const BILLING_DISABLED = true;

/**
 * Google sign-in stays off until the Supabase Google provider is enabled
 * for project qyqomxuxtpbhnicbtmbq. Email and password remain available.
 */
export const GOOGLE_AUTH_ENABLED = false;
