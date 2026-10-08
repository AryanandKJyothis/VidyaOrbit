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

Student caps live in `src/lib/plan-limits.ts` and in `public.plan_student_limit` (after `20261008093000`). They are **not** env-overridable.

### Setup fee

Charged only when **no activated order** exists for the owner **and** the cycle is monthly **and** the tier's setup amount is > 0. Annual always waives it. A Starter-first account therefore never pays Growth/Large setup later.

**Known gap (finding 19):** two unpaid first orders created in parallel can both include setup. If both are captured, setup is charged twice. Mitigate by not creating duplicate unpaid orders from two tabs; a follow-up can reuse an unpaid `created` order for the same owner/tier/cycle from the last 30 minutes.

## Migration order

Apply on the Supabase project that Preview uses (today that is prod `qyqomxuxtpbhnicbtmbq`) **before** setting `BILLING_ENABLED=true`:

1. `20261008091700_fix_enforce_student_limit_exclude_archived.sql` — student-limit trigger ignores `status = 'archived'`.
2. `20261008091800_create_billing_orders_table.sql` — table, RLS, `ON DELETE RESTRICT` so payment rows survive user deletion, owner SELECT only.
3. `20261008093000_pro_plan_unlimited.sql` — `plan_student_limit('pro')` = 2147483647 with `SET search_path = public` as a function attribute. Required before selling Large as unlimited.
4. `20261008094000_atomic_billing_activation.sql` — `tier`/`cycle` NOT NULL columns, grant hardening, `activate_billing_order`.

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
3. Else: `GREATEST(now(), COALESCE(expiry_date, now())) + 1 month` or `+ 12 months`.
4. Map `large` → `pro`. Preserve `notes` and `start_date`. `plan_price` is the `subscription_charge` line in rupees (never 0).
5. Call live `apply_subscription_change(..., _confirm => true)`, which writes `subscription_audit`.

Verify and the webhook call **only** this RPC via `activateOrderOnce()` in `src/lib/billing-activation.ts`. Any exception rolls back `activated_at`, so Razorpay can retry.

## Payment flow

1. Owner POSTs `{tier, cycle}` to `/api/billing/create-order`. Server computes amount, stores `tier`/`cycle`/`line_items`, creates a Razorpay order.
2. Checkout.js opens. Client never sends an amount.
3. On success the client POSTs the Checkout payload to `/api/billing/verify-payment`.
4. Verify: HMAC of `order_id|payment_id` with length-checked `timingSafeEqual`, fetch payment, require `payment.order_id` match, amount/currency match, owner match.
   - `captured` → `activate_billing_order`. UI: "Your plan is now active".
   - `authorized` → `{ok:true,status:"pending"}`. UI: "Payment received, processing. We'll confirm shortly." Then poll subscription refresh for 60s. Webhook activates on capture.
5. Webhook (`payment.captured` / `order.paid`): signature over **raw** `request.text()`, dedupe `x-razorpay-event-id` into `delivery_hash` (upsert ignoreDuplicates; reprocess if `handled` is false). Payment is `payload.payment.entity` for both events. DB errors on order lookup return **500**. Genuine unknown order ids return 200 `order_not_found`. Stored `raw_body` is ids/event/amount/currency/status/method only (no customer PII).

## create-order rules

- 503 unless `BILLING_ENABLED=true`.
- Bearer owner only. No institute row → 403 `NOT_OWNER`.
- Comped non-free (`plan_price = 0` or `expiry_date` null) → 400.
- **Mid-term tier change:** if the current *paid* plan is a different `plan_code` and more than 7 calendar days remain, 409 `TIER_CHANGE_CONTACT_SUPPORT` with message *To change plans, message us on WhatsApp, we'll adjust your remaining time*. Same-tier renewals still extend from current expiry. Free, expired, or ≤7 days left may buy any tier.
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
- Refunds and mid-term plan changes are manual (WhatsApp/email).
