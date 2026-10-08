# Razorpay In-App Payments

Complete documentation for the Razorpay in-app payment integration in Vidya Orbit.

## Overview

Vidya Orbit uses **Razorpay Standard Checkout** (modal flow) with **one-time orders** to handle subscription payments. Each payment creates a Razorpay Order, extends the subscription expiry by 1 month (monthly) or 12 months (annual), and is recorded in the `billing_orders` table.

**Key Design**:
- No auto-recurring subscriptions
- Server-side pricing only (client sends tier+cycle)
- Idempotent activation via `activated_at` timestamp
- Webhook backup activation for payment.captured / order.paid events
- Test mode enforced by default (`RAZORPAY_ALLOW_LIVE=false`)

---

## Pricing Model

### Tiers & Cycles

| Tier | Students | Monthly | Annual | Monthly Setup | Annual Setup |
|------|----------|---------|--------|---------------|-------------|
| **Starter** | 100 | ₹499 | ₹4,999 | ₹0 | ₹0 |
| **Growth** | 500 | ₹999 | ₹10,000 | ₹5,000 | ₹0 (waived) |
| **Large** | Unlimited* | ₹2,499 | ₹25,000 | ₹5,000 | ₹0 (waived) |

\* Large maps to Pro subscription (unlimited after migration `20261008093000_pro_plan_unlimited.sql`)

### Setup Fee Logic

- **Charged once** on first paid order (no prior paid `billing_orders` for owner)
- **Monthly**: Growth and Large charge ₹5,000 setup
- **Annual**: Setup waived for all tiers
- **Cross-cycle protection**: Accounts that start annual never pay setup when switching to monthly

### Annual Savings

- **Starter**: ₹989 (₹499×12 - ₹4,999)
- **Growth**: ₹1,988 + free ₹5,000 setup
- **Large**: ₹4,988 + free ₹5,000 setup

---

## Architecture

### Payment Flow

1. **Client**: Calls `POST /api/billing/create-order` with `{tier, cycle}`
2. **Server**:
   - Validates owner, checks for comped/no-expiry accounts
   - Computes pricing server-side (including setup fee logic)
   - Creates Razorpay Order via API
   - Inserts `billing_orders` row (status=`created`)
3. **Client**: Loads Razorpay checkout.js modal with order_id
4. **Razorpay**: User pays, modal returns `{razorpay_order_id, razorpay_payment_id, razorpay_signature}`
5. **Client**: Calls `POST /api/billing/verify-payment` with payment response
6. **Server**:
   - Verifies HMAC-SHA256 signature
   - Fetches payment from Razorpay API, validates amount & currency
   - **Idempotent activation**: Updates `billing_orders` with `WHERE activated_at IS NULL`
   - Calls `apply_subscription_change` RPC only if activated_at was NULL
7. **Webhook** (backup): Razorpay sends `payment.captured` / `order.paid`
   - Dedupe on unique `x-razorpay-event-id`
   - Uses same `activateOrderOnce()` helper
   - Already-activated orders return `already_activated`, no duplicate extension

### Idempotent Activation

**Key guarantee**: Each order activates exactly once, even if:
- verify-payment is called multiple times
- webhook fires for both payment.captured AND order.paid
- verify-payment and webhook both run

**Implementation**:
```sql
UPDATE billing_orders
SET status = 'paid',
    paid_at = now(),
    activated_at = now(),
    razorpay_payment_id = $1
WHERE razorpay_order_id = $2
  AND activated_at IS NULL
RETURNING id, owner_id, intent;
```

Only the first UPDATE to set `activated_at` returns a row → only that call activates the subscription.

**Shared Helper**: `src/lib/billing-activation.ts` → `activateOrderOnce()`

---

## Database Schema

### `billing_orders` Table

```sql
CREATE TABLE billing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id TEXT UNIQUE NOT NULL,
  razorpay_payment_id TEXT UNIQUE,
  intent TEXT NOT NULL,  -- "starter_monthly", "growth_annual", etc.
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  line_items JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,  -- Idempotency key for activation
  
  CONSTRAINT fk_billing_orders_owner 
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
```

**Key Fields**:
- `intent`: Tier + cycle string (e.g. `"growth_monthly"`)
- `activated_at`: NULL until first activation, then set permanently
- `line_items`: JSON breakdown (optional, for setup fee display)

### Row Level Security

- **SELECT**: Owners can read their own orders
- **INSERT/UPDATE/DELETE**: Blocked for clients (server-only via service_role)

---

## API Endpoints

### `GET /api/billing/pricing`

Returns server pricing for all tiers and cycles.

**Response**:
```json
{
  "billingEnabled": true,
  "tiers": [
    {
      "tier": "starter",
      "name": "Starter",
      "description": "For growing coaching centres",
      "studentLimit": 100,
      "monthlyPricePaise": 49900,
      "annualPricePaise": 499900,
      "setupFeePaise": 0,
      "features": ["Up to 100 students", "All core features", "Email support"]
    },
    ...
  ],
  "cycles": [
    { "cycle": "monthly", "label": "Monthly" },
    { "cycle": "annual", "label": "Annual" }
  ]
}
```

### `POST /api/billing/create-order`

Creates a Razorpay Order for checkout.

**Request**:
```json
{
  "tier": "growth",
  "cycle": "annual"
}
```

**Server Logic**:
1. Validates tier and cycle
2. Checks owner permissions
3. **Blocks comped accounts** (plan_price=0) → "contact support"
4. **Blocks no-expiry accounts** (expiry_date=null) → "contact support"
5. Computes pricing with setup fee logic
6. Creates Razorpay Order
7. Inserts `billing_orders` row

**Response**:
```json
{
  "ok": true,
  "orderId": "order_xyz123",
  "amount": 1000000,
  "currency": "INR",
  "keyId": "rzp_test_..."
}
```

**Error Codes**:
- `COMPED_ACCOUNT`: Account has plan_price=0
- `NO_EXPIRY_ACCOUNT`: Account has expiry_date=null
- `NOT_OWNER`: Only owner can purchase

### `POST /api/billing/verify-payment`

Verifies payment signature and activates subscription idempotently.

**Request**:
```json
{
  "razorpay_order_id": "order_xyz123",
  "razorpay_payment_id": "pay_abc456",
  "razorpay_signature": "abc123..."
}
```

**Server Logic**:
1. Verify HMAC-SHA256 signature
2. Fetch payment from Razorpay API
3. Validate amount & currency match stored order
4. **Idempotent activation**:
   - UPDATE billing_orders SET activated_at=now() WHERE activated_at IS NULL
   - If row returned: call apply_subscription_change RPC
   - If no row: already activated, return success

**Response**:
```json
{
  "ok": true
}
```

### `POST /api/webhooks/razorpay`

Handles Razorpay webhook events for backup activation.

**Events**:
- `payment.captured`: Payment was captured
- `order.paid`: Order was fully paid

**Deduplication**:
- Uses unique `x-razorpay-event-id` header
- Stores in `razorpay_webhook_deliveries.delivery_hash`
- Duplicate events return 200 OK immediately

**Activation**:
- Extracts `order_id` from payload
- Calls `activateOrderOnce()` (same as verify-payment)
- Already-activated orders ignored silently

---

## Subscription Extension Logic

**Rule**: Expiry extends by 1 month (monthly) or 12 months (annual) from `max(now, current_expiry)`

**Examples**:
- Current expiry: 2026-01-15, today: 2025-12-01, monthly → new expiry: 2026-02-15
- Current expiry: 2025-11-01 (past), today: 2025-12-01, monthly → new expiry: 2026-01-01
- Annual purchase → +12 months

**Tier Switches**:
- New tier takes effect immediately
- Expiry calculation same as renewal (leftover time carries over)
- Documented as accepted v1 simplification

**Admin Field Preservation**:
- `notes` field preserved across activations
- `start_date` preserved (not reset)
- `plan_price` set to NULL (price tracked in billing_orders)

---

## Migrations

Apply in this order:

1. `20261008091700_fix_enforce_student_limit_exclude_archived.sql`
   - Updates trigger to exclude `status='archived'` students from limit

2. `20261008091800_create_billing_orders_table.sql`
   - Creates `billing_orders` table
   - Adds `activated_at` column
   - Sets up RLS policies

3. `20261008093000_pro_plan_unlimited.sql` (**SEPARATE, DO NOT APPLY**)
   - Sets Pro student limit to 2147483647 (unlimited)
   - Only apply after testing and explicit approval

---

## Environment Variables

All server-only (no `VITE_` prefix).

### Required

```bash
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
BILLING_ENABLED=true  # Defaults to FALSE
```

### Optional (defaults shown, all in paise)

```bash
# Starter
BILLING_STARTER_STUDENT_LIMIT=100
BILLING_STARTER_MONTHLY_PRICE_PAISE=49900
BILLING_STARTER_ANNUAL_PRICE_PAISE=499900
BILLING_STARTER_SETUP_FEE_PAISE=0

# Growth
BILLING_GROWTH_STUDENT_LIMIT=500
BILLING_GROWTH_MONTHLY_PRICE_PAISE=99900
BILLING_GROWTH_ANNUAL_PRICE_PAISE=1000000
BILLING_GROWTH_SETUP_FEE_PAISE=500000

# Large
BILLING_LARGE_STUDENT_LIMIT=2147483647
BILLING_LARGE_MONTHLY_PRICE_PAISE=249900
BILLING_LARGE_ANNUAL_PRICE_PAISE=2500000
BILLING_LARGE_SETUP_FEE_PAISE=500000

# Safety
RAZORPAY_ALLOW_LIVE=false  # Must be true for live keys
```

---

## Frontend Components

### `/plan` Page

- Current plan status (tier, expiry, student usage)
- Renewal banner (7 days before expiry)
- Expired state alert
- Monthly/annual toggle (default: annual)
- Three tier cards with:
  - Prices from `GET /api/billing/pricing`
  - Savings display for annual
  - Setup fee line for monthly (when applicable)
  - Pay button (owner only, when BILLING_ENABLED=true)
  - "Contact us" fallback
- GST TODO note

### `/pricing` Page

- Public marketing page
- Same tier/cycle display
- Read-only (no checkout)
- Honest pricing display

### `RazorpayCheckout` Component

- Loads Razorpay checkout.js dynamically
- Handles payment modal
- Calls verify-payment on success
- Error handling with toast notifications

---

## Testing

### Unit Tests

**File**: `src/lib/billing-pricing.test.ts`

**Coverage** (22 tests):
- All tier+cycle combinations
- Setup fee logic (first order, monthly/annual, cross-cycle)
- Monthly→Annual and Annual→Monthly switches
- Savings calculations
- Signature verification (valid, invalid, length mismatch)

**Run**: `npm run test:run`

### Manual Testing Checklist

1. Create order for each tier+cycle
2. Complete payment in Razorpay test mode
3. Verify subscription extended correctly
4. Test webhook activation (disable verify-payment)
5. Test duplicate activation attempts (should be idempotent)
6. Test comped account rejection
7. Test owner-only restrictions

---

## Security

### HMAC Signature Verification

**verify-payment**:
```javascript
const expectedSig = crypto
  .createHmac("sha256", keySecret)
  .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  .digest("hex");

// Length check before timingSafeEqual
if (expectedSig.length !== razorpay_signature.length) {
  return invalid();
}

const isValid = crypto.timingSafeEqual(
  Buffer.from(expectedSig),
  Buffer.from(razorpay_signature)
);
```

**webhook**:
```javascript
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay-webhook-verify";

const isValid = verifyRazorpayWebhookSignature(
  rawBody,
  signature,
  webhookSecret
);
```

### Rate Limiting

- `create-order`: 10 requests / 60s per IP
- `verify-payment`: 10 requests / 60s per IP
- `webhooks/razorpay`: 50 requests / 60s per IP

### Live Key Protection

```typescript
assertRazorpayKeyMode(keyId);
```

Throws error if `keyId.startsWith("rzp_live_")` and `RAZORPAY_ALLOW_LIVE !== "true"`.

---

## Audit Fixes (2026-10-08)

### 1. Double/Triple Activation (HIGH)

**Problem**: verify-payment activated, then webhook activated again for BOTH payment.captured AND order.paid → 3x extensions

**Fix**:
- Added `activated_at` column to `billing_orders`
- Created `activateOrderOnce()` helper with conditional UPDATE
- Both verify-payment and webhook use same path
- Webhook dedupe fixed: uses unique `x-razorpay-event-id` (not event_type)
- Only ONE activation per order guaranteed

### 2. Admin Field Clobbering (MEDIUM)

**Problem**: Activations overwrote admin notes, reset start_date, set price=null, clobbered comped accounts

**Fix**:
- Comped accounts (plan_price=0) blocked in create-order
- No-expiry accounts blocked in create-order
- Clear error: "contact support"
- Admin notes and start_date preserved
- Tier switches documented

### 3. Pro Unlimited Migration (LOW)

**Problem**: Missing `SET search_path TO 'public'`

**Fix**: Restored in migration file

### 4. Admin UI Hardcoded Limits (LOW)

**Problem**: Pro always showed 1,000

**Fix**: Display "Unlimited" when limit >= 2147483647 or null

---

## Known Limitations

1. **GST**: Not yet implemented (prices are pre-tax)
2. **Tier switches**: Leftover time carries over (v1 simplification)
3. **Refunds**: Manual process (not automated)
4. **Prorated upgrades**: Not supported (full period charged)

---

## Future Enhancements

- GST calculations and invoicing
- Prorated tier upgrades/downgrades
- Auto-retry failed payments
- Payment history page
- Invoice generation
- Cancellation flow

---

## References

- [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/)
- [Razorpay Webhooks](https://razorpay.com/docs/webhooks/)
- [Razorpay Signature Verification](https://razorpay.com/docs/payments/server-integration/nodejs/payment-gateway/build-integration/#signature-verification)
