# Razorpay Standard Checkout (Vidya Orbit)

This stack uses **TanStack Start** + **Supabase**. Razorpay **never** sends `KEY_SECRET` or the webhook secret to the browser — only `KEY_ID` is returned to Checkout.

This is a **one-time order** flow (no Razorpay Subscriptions / plan IDs).

## 1. Razorpay dashboard

1. **Keys** (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`). Use `rzp_test_…` on Preview.
2. **Confirm auto-capture is ON** (test mode). If capture is off, verify returns `pending` and the webhook activates on `payment.captured`.
3. **Webhooks**
   - URL: `https://<your-deployed-domain>/api/webhooks/razorpay`
   - Generate `RAZORPAY_WEBHOOK_SECRET`.
   - Subscribe to `payment.captured` and `order.paid` only.
   - Preview is behind Vercel Authentication: add Vercel Protection Bypass for Automation as `?x-vercel-protection-bypass=…` on the webhook URL, or Razorpay gets a 302 to SSO.

## 2. Server env (Preview first)

See `env.example`. Required to take a test payment:

- `BILLING_ENABLED=true` (exact string; default off)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- Leave `RAZORPAY_ALLOW_LIVE` unset so `rzp_live_` keys are refused

Apply the billing migrations **before** enabling billing (Preview shares the prod Supabase project):

1. `20261008091700_fix_enforce_student_limit_exclude_archived.sql`
2. `20261008091800_create_billing_orders_table.sql`
3. `20261008093000_pro_plan_unlimited.sql` (Large is sold as unlimited)
4. `20261008094000_atomic_billing_activation.sql`

## 3. Test cards

Card `4111 1111 1111 1111`, any future expiry, any CVV. UPI: `success@razorpay`.

## 4. What not to create

Do **not** create Razorpay Subscription Plans or set `RAZORPAY_PLAN_*`. The old hosted-subscription routes have been removed.
