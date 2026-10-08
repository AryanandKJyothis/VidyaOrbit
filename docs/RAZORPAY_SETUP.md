# Razorpay Standard Checkout (Vidya Orbit)

This stack uses **TanStack Start** + **Supabase**. Razorpay **never** sends `KEY_SECRET` or the webhook secret to the browser — only `KEY_ID` is returned to Checkout.

This is a **one-time order** flow (no Razorpay Subscriptions / plan IDs).

## 1. Razorpay dashboard

1. **Keys** (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`). Use `rzp_test_…` on Preview.
2. **Auto-capture must be ON** (Dashboard → Settings → Capture). If capture is off, verify returns `pending` and the webhook activates on `payment.captured`.
3. **Webhooks**
   - URL must **not** contain `razorpay` in the domain (Razorpay rejects that). Do **not** use the Git branch alias. Use the **deployment-specific Preview URL** plus Vercel Protection Bypass for Automation:
     `https://<deployment-id>-….vercel.app/api/webhooks/razorpay?x-vercel-protection-bypass=…`
   - Generate `RAZORPAY_WEBHOOK_SECRET`.
   - Subscribe to `payment.captured` and `order.paid` only.
   - Preview is behind Vercel Authentication: the bypass query param is required, or Razorpay gets a 302 to SSO.

## 2. Server env (Preview first)

See `env.example`. Required to take a test payment:

- `BILLING_ENABLED=true` (exact string; default off)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- Leave `RAZORPAY_ALLOW_LIVE` unset so `rzp_live_` keys are refused (`RAZORPAY_ALLOW_LIVE` must be the exact string `true` to allow live keys)

Charged prices come from code constants in `billing-pricing.ts` (kept in lockstep with `pricing-display.ts`). They are **not** env-overridable.

Apply the billing migrations **before** enabling billing (Preview shares the prod Supabase project). Apply **individually, one at a time**, never `supabase db push --include-all`:

1. `20261008091700_fix_enforce_student_limit_exclude_archived.sql`
2. `20261008091800_create_billing_orders_table.sql`
3. `20261008094000_atomic_billing_activation.sql`
4. `20261008095000_revoke_client_writes_subscriptions.sql`

`20261008093000_pro_plan_unlimited.sql` is **already live** in prod; skip unless `plan_student_limit('pro')` is not 2147483647.

`billing_orders` rows are created at **order time**. `key_mode` is set server-side from the `RAZORPAY_KEY_ID` prefix (`rzp_test_` → `test`, `rzp_live_` → `live`), never from the client.

Setup is a **one-time onboarding fee**. Any captured **live** billing order (monthly or annual, any plan, with or without a setup line, including a `needs_review` hold) sets `setup_fee_paid`. Test-mode captures still activate (so Preview can be tested) but never set the flag and never count as already paid. An invoice the admin marks paid also sets it. Trials and comps do not. After a live payment, checkout never charges the ₹5,000 setup again (so annual-then-monthly, or Starter-then-Growth, is not charged setup).

The webhook returns **503** while `BILLING_ENABLED` is off. Razorpay will retry and eventually disable the webhook, so enable billing before registering it, or expect retries.

## 3. Test cards

Card `4100 2800 0000 1007`, any future expiry, any CVV. UPI: `success@razorpay` / `failure@razorpay`.

## 4. What not to create

Do **not** create Razorpay Subscription Plans or set `RAZORPAY_PLAN_*`. The old hosted-subscription routes have been removed.
