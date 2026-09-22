# Razorpay subscription billing (Vidya)

This stack uses **TanStack Start (Cloudflare)** + **Supabase**. Razorpay **never** touches the browser with your `KEY_SECRET` or webhook secret — only KEY_ID ends up exposed if used for hosted checkout redirects.

## 1. Razorpay dashboard

1. **Keys** (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
2. **Plans** → create three monthly subscriptions plans matching Vidya tiers: Starter, Growth, Pro. Copy each `plan_…` ID into `.env`/secrets:
   - `RAZORPAY_PLAN_STARTER`
   - `RAZORPAY_PLAN_GROWTH`
   - `RAZORPAY_PLAN_PRO`
3. **Webhooks**
   - URL: `https://<your-deployed-domain>/api/webhooks/razorpay`
   - Generate `RAZORPAY_WEBHOOK_SECRET`.
   - Enable subscription events (`subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.resumed`, `subscription.halted`, `subscription.paused`, `subscription.cancelled`, `subscription.completed`).

## 2. Supabase secrets (server)

Billing writes go through **`SUPABASE_SERVICE_ROLE_KEY`** (already required for webhook upserts bypassing row-level locks on `subscriptions`).

Customer rows include `notes.owner_id` so webhooks reconcile to the owning Supabase `auth.uid()`.

## 3. Operational notes

- Every institute owner must save a **billing email** (`institutes.contact_email`) before subscribing — Razorpay needs a payer email.
- After payment Razorpay calls the webhook; the backend upserts `subscriptions.plan` instantly so student limits unlock without manual edits.
- If webhooks lag, open Billing — the app polls `POST /api/billing/sync-subscription` while checkout is pending and on window focus.
- Plan IDs in secrets must match the same Razorpay mode as `RAZORPAY_KEY_ID` (test keys → test `plan_…` IDs; live keys → live plan IDs). Mismatches cause “Hosted page is not available”.

## 4. Local testing

Expose your dev server publicly (Cloudflare Tunnel, ngrok, etc.) while wiring webhooks—or use Razorpay’s test mode endpoints with the HTTPS tunnel URL recorded in the Razorpay dashboard.
