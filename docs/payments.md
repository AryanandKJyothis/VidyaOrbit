# Razorpay In-App Payments Documentation

This document covers the Razorpay Standard Checkout integration for Vidya Orbit's annual subscription plans.

## Overview

Vidya Orbit uses Razorpay Standard Checkout for in-app payment processing. The system supports:
- **Annual plan**: ₹10,000/year (Growth tier, 500 students)
- **One-time setup fee**: ₹5,000 (first purchase only)
- **Server-side pricing**: The client never sends amounts
- **Idempotent activation**: Payments activate subscriptions exactly once

## Architecture

### Order-based Flow (not subscription-based)

1. **Client** initiates checkout → `/api/billing/create-order`
2. **Server** computes price, creates Razorpay order, stores in `billing_orders`
3. **Client** opens Razorpay checkout modal
4. **User** completes payment via Razorpay
5. **Client** receives payment response → `/api/billing/verify-payment`
6. **Server** verifies HMAC signature, confirms payment with Razorpay, marks order paid, activates subscription
7. **Webhook** (backup) on `payment.captured` or `order.paid` activates via the same idempotent path

### Database Schema

#### `billing_orders`
```sql
CREATE TABLE billing_orders (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  razorpay_order_id text UNIQUE NOT NULL,
  razorpay_payment_id text UNIQUE,
  intent text NOT NULL, -- 'activate' or 'renew'
  amount_paise integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created', -- 'created', 'paid', 'failed'
  line_items jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
```

- **intent**:
  - `activate`: first purchase (includes setup fee if not already paid)
  - `renew`: annual renewal (annual charge only)
- **line_items**: JSON array, e.g. `[{"item": "setup_fee", "amount": 500000}, {"item": "annual_plan", "amount": 1000000}]`

## Environment Variables

All variables are **server-only** (no `VITE_` prefix).

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `RAZORPAY_KEY_ID` | Razorpay API key ID (test: `rzp_test_*`, live: `rzp_live_*`) | `rzp_test_abc123` |
| `RAZORPAY_KEY_SECRET` | Razorpay API key secret | `secret_xyz789` |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature secret (from Razorpay dashboard) | `whsec_abc123xyz` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `BILLING_ENABLED` | Enable/disable billing endpoints | `true` |
| `BILLING_SETUP_FEE_PAISE` | Setup fee in paise | `500000` (₹5,000) |
| `BILLING_ANNUAL_PLAN_PAISE` | Annual plan price in paise | `1000000` (₹10,000) |
| `BILLING_ANNUAL_PLAN_STUDENT_LIMIT` | Student limit for annual plan | `500` |
| `RAZORPAY_ALLOW_LIVE` | Allow live keys (must be `true` to use `rzp_live_*`) | `false` |

### Safety Guards

- **Test/live guard**: The system refuses to run with `rzp_live_*` keys unless `RAZORPAY_ALLOW_LIVE=true` is explicitly set.
- **Billing disabled by default**: Set `BILLING_ENABLED=true` (or remove `BILLING_DISABLED=true`) to enable payment endpoints.

## Migration Files

Apply migrations in this order:

1. `20261008091700_fix_enforce_student_limit_exclude_archived.sql`
   - Fixes `enforce_student_limit()` to exclude archived students from plan limit count
2. `20261008091800_create_billing_orders_table.sql`
   - Creates `billing_orders` table with RLS policies

## API Endpoints

### POST `/api/billing/create-order`
Creates a Razorpay order.

**Request**:
```json
{
  "intent": "activate" | "renew"
}
```

**Response** (success):
```json
{
  "ok": true,
  "orderId": "order_ABC123",
  "amount": 1500000,
  "currency": "INR",
  "keyId": "rzp_test_abc123"
}
```

**Errors**:
- `503 BILLING_DISABLED`: Billing not enabled
- `503 NOT_CONFIGURED`: Missing Razorpay credentials
- `403 LIVE_KEY_BLOCKED`: Live keys without `RAZORPAY_ALLOW_LIVE=true`
- `403 NOT_OWNER`: Only workspace owners can purchase

### POST `/api/billing/verify-payment`
Verifies payment signature and activates subscription.

**Request**:
```json
{
  "razorpay_order_id": "order_ABC123",
  "razorpay_payment_id": "pay_XYZ789",
  "razorpay_signature": "abcdef123456..."
}
```

**Response** (success):
```json
{
  "ok": true,
  "paymentId": "pay_XYZ789",
  "orderId": "order_ABC123",
  "alreadyPaid": false
}
```

**Errors**:
- `400 INVALID_SIGNATURE`: Signature verification failed
- `404 ORDER_NOT_FOUND`: Order not found in database
- `403 OWNERSHIP_MISMATCH`: Order belongs to different user
- `400 PAYMENT_NOT_CAPTURED`: Payment status not captured/authorized
- `400 AMOUNT_MISMATCH`: Payment amount doesn't match order

### POST `/api/webhooks/razorpay`
Webhook handler for `payment.captured` and `order.paid` events.

**Headers**:
- `x-razorpay-signature`: HMAC-SHA256 signature of raw body
- `x-razorpay-event-id`: Unique event ID for deduplication

**Events handled**:
- `payment.captured`: Activates subscription from the paid order
- `order.paid`: Activates subscription from the paid order

**Deduplication**: Uses `x-razorpay-event-id` header (unique per event) stored in `razorpay_webhook_deliveries.event_type`.

## Testing

### Test Cards
- **Visa**: `4111 1111 1111 1111`
- **Any future expiry**, any CVV
- **UPI success**: `success@razorpay`
- **UPI failure**: `failure@razorpay`

### Test Flow

1. **Set test credentials**:
   ```bash
   RAZORPAY_KEY_ID=rzp_test_your_key_id
   RAZORPAY_KEY_SECRET=your_test_secret
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
   BILLING_ENABLED=true
   ```

2. **Start dev server** and navigate to `/plan` as a workspace owner.

3. **Click "Activate Annual Plan"** (or "Renew" if already active).

4. **Complete payment** in the Razorpay modal with test card.

5. **Verify**:
   - Subscription status updates to "active"
   - Plan changes to "Growth" (500 students)
   - Expiry date is 365 days from activation
   - Order is marked "paid" in `billing_orders`

### Webhook Testing

**IMPORTANT**: Test webhooks must go to a **Preview deployment** with a Vercel protection-bypass secret, **NEVER production**.

1. Deploy to Vercel Preview from your branch.
2. Get the Preview URL (e.g. `https://your-app-git-branch-user.vercel.app`).
3. If Preview has Vercel Protection enabled, add bypass secret: `?bypass=YOUR_SECRET`.
4. In Razorpay Dashboard → Webhooks:
   - URL: `https://your-preview-url.vercel.app/api/webhooks/razorpay?bypass=YOUR_SECRET`
   - Events: `payment.captured`, `order.paid`
   - Secret: Copy the webhook secret to `RAZORPAY_WEBHOOK_SECRET`.
5. Test a payment and verify webhook delivery in Razorpay dashboard.

### Unit Tests

Run tests:
```bash
npm test
```

Test files:
- `src/lib/billing-pricing.test.ts`: Pricing calculation (setup fee, annual plan, intents)
- `src/lib/razorpay-signature.test.ts`: HMAC-SHA256 signature verification

## Security

### Server-side Pricing
- The client sends only `intent` ("activate" or "renew") and workspace ID
- The server computes amounts based on:
  - Configured prices (`BILLING_SETUP_FEE_PAISE`, `BILLING_ANNUAL_PLAN_PAISE`)
  - Whether setup fee has been paid before (checked in `billing_orders`)
- **Never trust amounts from the client**

### Signature Verification
- **Order verification** uses HMAC-SHA256(`order_id|payment_id`, `KEY_SECRET`)
- **Webhook verification** uses HMAC-SHA256(raw body, `WEBHOOK_SECRET`)
- Both use constant-time comparison (`crypto.timingSafeEqual`) with length check

### Idempotent Activation
- Orders are marked paid with a conditional update: `WHERE status='created'`
- If the update returns no rows, the order was already paid (idempotent)
- Subscription is activated via `apply_subscription_change` RPC, which handles over-limit checks

### RLS Policies
- **billing_orders**: Owners can `SELECT` their own rows; no client `INSERT`/`UPDATE`/`DELETE`
- **subscriptions**: Read-only for clients; writes via server with service_role
- **subscription_audit**: No client access; server-only audit log

## Troubleshooting

### "Payment system is not configured"
- Check that `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` are set
- Ensure they are **server-only** variables (no `VITE_` prefix)
- For Vercel: set them in Project Settings → Environment Variables

### "Refusing to use live Razorpay keys"
- You're using a `rzp_live_*` key without explicit opt-in
- Set `RAZORPAY_ALLOW_LIVE=true` only when you're ready to go live
- **Never set this on Preview deployments**

### Webhook signature mismatch
- Verify `RAZORPAY_WEBHOOK_SECRET` matches the secret in Razorpay dashboard
- Check that the webhook URL is correct (including bypass token if needed)
- Ensure raw body is passed to verification (no JSON parsing before HMAC)

### Payment verified but subscription not activated
- Check server logs for RPC errors
- Verify `apply_subscription_change` function exists in database
- Check that `billing_orders` table and migrations are applied
- Confirm workspace owner exists in `institutes` table

### Duplicate webhook deliveries
- The system deduplicates by `x-razorpay-event-id` header
- Check `razorpay_webhook_deliveries` table for `handled=true`
- If a webhook fails processing, it's **not marked handled** so Razorpay will retry

## Production Checklist

Before going live:

1. **Test mode validation**:
   - [ ] All test payments work end-to-end
   - [ ] Webhook receives and processes events correctly
   - [ ] Subscription activates with correct plan and expiry

2. **Live credentials**:
   - [ ] Obtain live API keys from Razorpay (`rzp_live_*`)
   - [ ] Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` for production
   - [ ] Set `RAZORPAY_ALLOW_LIVE=true` (production only)
   - [ ] Remove bypass tokens from webhook URL

3. **Compliance**:
   - [ ] Add GST/tax information to the UI (marked as TODO in `/plan`)
   - [ ] Update Terms of Service to include subscription terms
   - [ ] Add refund policy

4. **Monitoring**:
   - [ ] Set up alerts for payment failures
   - [ ] Monitor `billing_orders` for stuck "created" orders
   - [ ] Track webhook delivery failures in Razorpay dashboard

## GST and Taxes

The current implementation displays a **TODO** note for GST information. Before going live:
- Determine if your business is GST-registered
- Add GST number and tax breakdown to the pricing display
- Consult with a tax advisor for proper compliance

## Migration from Old Subscription Flow

The old `/api/billing/start-subscription` endpoint used Razorpay Subscriptions with a hosted `short_url`. It has been retired in favor of the in-app order-based checkout.

- Old flow: Redirected users to Razorpay hosted page
- New flow: In-app checkout modal via Razorpay Standard Checkout
- Migration: Old webhook events for `subscription.authenticated` etc. are ignored; only `payment.captured` and `order.paid` are processed

## Support

For Razorpay-specific issues:
- Razorpay documentation: https://razorpay.com/docs/payments/
- Razorpay support: https://razorpay.com/support/

For Vidya Orbit billing issues:
- Check server logs for detailed error messages
- Verify environment variables are set correctly
- Ensure migrations are applied in the correct order
