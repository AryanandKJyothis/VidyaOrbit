# Razorpay In-App Payments

Vidya Orbit uses **Razorpay Standard Checkout** with **one-time orders**. There is no Razorpay Subscription object, no auto-renewal, and no `RAZORPAY_PLAN_*` ids.

Each successful capture creates (or reuses) a row in `billing_orders` and calls the transactional SQL function `activate_billing_order`. That function is the **only** path that marks an order paid and extends `subscriptions`.

## Pricing

Amounts are computed on the server in paise. Env overrides must be integers ≥ 100 paise for prices and ≥ 0 for setup.

| Tier (checkout) | `plan_code` | Students | Monthly | Annual | Setup (monthly, first paid order only) |
|---|---|---|---|---|---|
| Starter | `starter` | 100 | ₹499 | ₹4,999 | ₹0 |
| Growth | `growth` | 500 | ₹999 | ₹10,000 | ₹5,000 |
| Large | `pro` | Unlimited | ₹2,499 | ₹25,000 | ₹5,000 |

Student caps live in `src/lib/plan-limits.ts` and in `public.plan_student_limit` (after `20261008093000`). They are **not** env-overridable. UI helpers `isUnlimited` / `formatLimit` never print the Postgres sentinel `2147483647`.

Public `/pricing` display strings in `use-subscription.ts` `PLANS` stay on master's copy (Pro / ₹2,999 / 1,000 students). In-app checkout prices come from `GET /api/billing/pricing`.

### Setup fee

Charged only on **monthly** Growth/Large when setup is not already paid. Annual always waives it.

Setup is already paid (server-side, same answer for create-order and `/plan`) when any of:

- `subscriptions.setup_fee_paid` is true (admin toggle; backfilled true for institutes currently on a paid plan)
- current `plan` is not `free` (invoice / admin-set paid centres)
- `expiry_date` is set (past paid_until)
- an activated online `billing_orders` row exists

A paid capture also sets `setup_fee_paid = true`. `/plan` reads `subscription_health.setup_fee_paid` and does not query `billing_orders` from the client. Annual cards do not show "+ free ₹5,000 setup" when setup is already paid.

**Known gap:** two unpaid first orders created in parallel can both include setup. If both are captured, setup is charged twice.

## Migration order

Apply on the Supabase project that Preview uses (today that is prod `qyqomxuxtpbhnicbtmbq`) **before** setting `BILLING_ENABLED=true`. Preview uses the production database, so these run together in this order — not as a later follow-up after Preview testing:

1. `20261008091700_fix_enforce_student_limit_exclude_archived.sql` — insert trigger **and** `subscription_health` ignore `status = 'archived'`. Workspace members (and service_role) may read the owner's plan. Admin summary/detail and `apply_subscription_change` use the same non-archived student count. Over-limit error labels `pro` as **Large**.
2. `20261008091800_create_billing_orders_table.sql` — table, RLS, `ON DELETE RESTRICT` so payment rows survive user deletion, owner SELECT only.
3. `20261008093000_pro_plan_unlimited.sql` — `plan_student_limit('pro')` = 2147483647 with `SET search_path = public` as a function attribute. Required before selling Large as unlimited.
4. `20261008094000_atomic_billing_activation.sql` — idempotent `tier`/`cycle`/`needs_review` columns, `subscriptions.setup_fee_paid`, grant hardening, `activate_billing_order` (mid-term tier hold).

Do not apply these from this agent. An operator applies them.

## Activation (`activate_billing_order`)

Signature:

```sql
activate_billing_order(
  _order_id uuid,
  _payment_id text,
  _amount bigint,
  _currency text
) RETURNS jsonb
```

`SECURITY DEFINER`, `SET search_path = public`, `EXECUTE` revoked from `PUBLIC`/`anon`/`authenticated`, granted to `service_role`. Guard uses `auth.role()`.

Behaviour:

1. Conditional `UPDATE billing_orders … WHERE id = _order_id AND activated_at IS NULL AND amount_paise = _amount AND upper(currency) = upper(_currency) RETURNING *`.
2. If no row: `already_activated` / `amount_or_currency_mismatch` / `order_not_found`.
3. Map `large` → `pro`.
4. **Mid-term different-tier hold (SQL is the source of truth):** if the current *paid* plan (`plan <> free`, `plan_price > 0`, future `expiry_date`) is a different `plan_code` and more than **7 Asia/Kolkata calendar days** remain, do **not** extend or switch. The order stays `paid` with `activated_at` set (no silent loss, no webhook retry loop), `needs_review = true`, and `review_reason` filled. Admin sees it on the institute dialog. Return `{activated:false, reason:'tier_change_needs_review'}`. Verify and the webhook treat this as HTTP 200.
5. Otherwise (same-tier renewal, ≤7 days left, expired, or free): `GREATEST(now(), COALESCE(expiry_date, now())) + 1 month` or `+ 12 months`. Postgres month arithmetic clamps (31 Jan + 1 month = 28/29 Feb). There is no JS `computeNewExpiry`.
6. Preserve `notes` and `start_date`. `plan_price` is the `subscription_charge` line in rupees (never 0). Call live `apply_subscription_change(..., _confirm => true)`. Set `setup_fee_paid = true`.

Verify and the webhook call **only** this RPC via `activateOrderOnce()` in `src/lib/billing-activation.ts`. Any exception rolls back `activated_at`, so Razorpay can retry. A `needs_review` hold does not roll back: the payment is recorded for admin.

Race this closes: Starter with ≤7 days left, open Large checkout (tab A), buy Starter annual (tab B), pay tab A. After tab B more than 7 days remain, so tab A is held for review instead of granting Large for ~13 months.

## Payment flow

1. Owner POSTs `{tier, cycle}` to `/api/billing/create-order`. Server computes amount, stores `tier`/`cycle`/`line_items`, creates a Razorpay order.
2. Checkout.js opens. Client never sends an amount.
3. On success the client POSTs the Checkout payload to `/api/billing/verify-payment`.
4. Verify: HMAC of `order_id|payment_id` with **byte-length**-checked `timingSafeEqual`, fetch payment, require `payment.order_id` match, amount/currency match, owner match. Order lookup DB errors return **500** (not 404).
   - `captured` + applied → `activate_billing_order`. UI: "Your plan is now active".
   - `captured` + hold (`tier_change_needs_review`, or `already_activated` with `needs_review` when the webhook won the race) → 200 `{ok:true, needsReview:true}`. UI: "Payment received. We'll contact you to switch your plan and adjust your remaining time" plus the contact link.
   - `authorized` → `{ok:true,status:"pending"}`. UI: "Payment received, processing. We'll confirm shortly." Then poll until expiry moves (same-tier renewal) or the purchased plan becomes active, or the order is `needs_review` (held message). Does not claim success on timeout.
5. Webhook (`payment.captured` / `order.paid`): signature over **raw** `request.text()`, dedupe `x-razorpay-event-id` into `delivery_hash` (upsert ignoreDuplicates; reprocess if `handled` is false). Payment is `payload.payment.entity` for both events. DB errors on order lookup return **500**. Genuine unknown order ids return 200 `order_not_found`. Stored `raw_body` is ids/event/amount/currency/status/method only (no customer PII).

## create-order rules

- 503 unless `BILLING_ENABLED=true`.
- Bearer owner only. No institute row → 403 `NOT_OWNER`.
- Comped non-free (`plan_price = 0` or `expiry_date` null) → 400.
- **Mid-term tier change:** if the current *paid* plan is a different `plan_code` and more than 7 **Asia/Kolkata** calendar days remain, 409 `TIER_CHANGE_CONTACT_SUPPORT` with `contactLink` (wa.me if `VITE_CONTACT_WHATSAPP` is set, else mailto). Message says "message us on WhatsApp" only when WhatsApp is configured, otherwise "contact us". Same-tier renewals still extend from current expiry. Free, expired, or ≤7 days left may buy any tier. Activation enforces the same rule (see above).
- Active (non-archived) student count above the target tier cap → 409 `OVER_TIER_LIMIT` (skipped for Large).
- Razorpay errors are logged server-side; the client gets a generic message.

## Public `/pricing`

This PR does **not** rewrite `/pricing`. Landing/pricing copy lives on master (and PR #8). In-app checkout is `/plan`, which reads `GET /api/billing/pricing` (`{billingEnabled, tiers:[…]}` always HTTP 200, including when billing is off). GST wording on `/plan`: "Prices are exclusive of GST. GST invoicing is coming soon."

## Environment

Server-only (no `VITE_` prefix except contact CTAs):

```
BILLING_ENABLED=false
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
# RAZORPAY_ALLOW_LIVE=true
# BILLING_*_PRICE_PAISE / BILLING_*_SETUP_FEE_PAISE
# VITE_CONTACT_WHATSAPP / VITE_CONTACT_EMAIL
```

## Known limitations

- GST is not added to the order amount.
- Concurrent unpaid first orders can both include setup (see above).
- Refunds and mid-term plan changes are manual (WhatsApp/email). Held different-tier captures appear as `needs_review` on the admin subscriptions dialog.
