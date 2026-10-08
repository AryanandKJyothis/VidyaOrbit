import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

const fromMock = vi.fn();
const rpcMock = vi.fn();
const parseBearerMock = vi.fn();
const ordersCreate = vi.fn();
const paymentsFetch = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock("@/server/require-bearer-user", () => ({
  parseBearerUserId: (...args: unknown[]) => parseBearerMock(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  allowRequest: () => true,
  clientAddress: () => "127.0.0.1",
  tooManyRequests: () =>
    Response.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 }),
}));

vi.mock("razorpay", () => ({
  default: class Razorpay {
    orders = { create: (...args: unknown[]) => ordersCreate(...args) };
    payments = { fetch: (...args: unknown[]) => paymentsFetch(...args) };
  },
}));

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORDER_UUID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RZ_ORDER = "order_test1";
const RZ_PAY = "pay_test1";
const KEY_SECRET = "test_key_secret";
const WEBHOOK_SECRET = "test_webhook_secret";

function thenable(result: {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  for (const m of [
    "select",
    "insert",
    "update",
    "upsert",
    "eq",
    "neq",
    "not",
    "is",
  ]) {
    api[m] = vi.fn(self);
  }
  api.maybeSingle = vi.fn(async () => result);
  api.single = vi.fn(async () => result);
  api.then = (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return api;
}

function enableBilling() {
  process.env.BILLING_ENABLED = "true";
  process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  delete process.env.RAZORPAY_ALLOW_LIVE;
}

function disableBilling() {
  delete process.env.BILLING_ENABLED;
}

function checkoutSig(orderId: string, paymentId: string) {
  return crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

function webhookSig(raw: string) {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
}

function handlerOf(route: unknown, method: "GET" | "POST") {
  const h = (
    route as {
      options: {
        server: {
          handlers: Record<
            string,
            (ctx: { request: Request }) => Promise<Response>
          >;
        };
      };
    }
  ).options.server.handlers[method];
  if (!h) throw new Error(`missing ${method} handler`);
  return (request: Request) => h({ request } as never);
}

function jsonReq(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("GET /api/billing/pricing", () => {
  afterEach(() => {
    disableBilling();
  });

  it("returns 200 with billingEnabled false and a tiers array when billing is off", async () => {
    disableBilling();
    const { Route } = await import("@/routes/api/billing/pricing");
    const res = await handlerOf(
      Route,
      "GET",
    )(new Request("http://localhost/api/billing/pricing"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.billingEnabled).toBe(false);
    expect(Array.isArray(body.tiers)).toBe(true);
    expect(body.tiers).toHaveLength(3);
    expect(
      body.tiers.find((t: { tier: string }) => t.tier === "large").studentLimit,
    ).toBeNull();
  });
});

describe("POST /api/billing/create-order", () => {
  beforeEach(() => {
    enableBilling();
    parseBearerMock.mockResolvedValue({ ok: true, userId: OWNER });
    ordersCreate.mockResolvedValue({
      id: RZ_ORDER,
      amount: 99900,
      currency: "INR",
    });
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  afterEach(() => disableBilling());

  async function postCreate(body: unknown, authHeader?: string) {
    const { Route } = await import("@/routes/api/billing/create-order");
    return handlerOf(
      Route,
      "POST",
    )(
      jsonReq("http://localhost/api/billing/create-order", body, {
        Authorization: authHeader ?? "Bearer tok",
      }),
    );
  }

  it("returns 401 when unauthenticated", async () => {
    parseBearerMock.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    });
    const res = await postCreate({ tier: "growth", cycle: "monthly" }, "");
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller has no institute (not owner)", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "subscriptions")
        return thenable({
          data: { plan: "free", plan_price: null, expiry_date: null },
          error: null,
        });
      if (table === "institutes") return thenable({ data: null, error: null });
      return thenable({ data: null, error: null, count: 0 });
    });
    const res = await postCreate({ tier: "growth", cycle: "monthly" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("NOT_OWNER");
  });

  it("stores the server-computed amount (growth monthly first order includes setup)", async () => {
    let inserted: {
      amount_paise?: number;
      tier?: string;
      cycle?: string;
    } | null = null;
    fromMock.mockImplementation((table: string) => {
      if (table === "subscriptions")
        return thenable({
          data: { plan: "free", plan_price: null, expiry_date: null },
          error: null,
        });
      if (table === "institutes")
        return thenable({ data: { owner_id: OWNER }, error: null });
      if (table === "students")
        return thenable({ data: null, error: null, count: 10 });
      if (table === "billing_orders") {
        const t = thenable({ data: null, error: null, count: 0 });
        (t.insert as ReturnType<typeof vi.fn>).mockImplementation((row) => {
          inserted = row as Record<string, unknown>;
          return t;
        });
        return t;
      }
      return thenable({ data: null, error: null });
    });
    const res = await postCreate({ tier: "growth", cycle: "monthly" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.amount).toBe(599900);
    const saved = inserted as {
      amount_paise?: number;
      tier?: string;
      cycle?: string;
    } | null;
    expect(saved?.amount_paise).toBe(599900);
    expect(saved?.tier).toBe("growth");
    expect(saved?.cycle).toBe("monthly");
    expect(ordersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 599900, currency: "INR" }),
    );
  });

  it("skips setup on a later monthly order after an activated order charged setup", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "subscriptions")
        return thenable({
          data: {
            plan: "growth",
            plan_price: 999,
            expiry_date: "2026-11-01",
            setup_fee_paid: false,
          },
          error: null,
        });
      if (table === "institutes")
        return thenable({ data: { owner_id: OWNER }, error: null });
      if (table === "students")
        return thenable({ data: null, error: null, count: 10 });
      if (table === "billing_orders")
        return thenable({
          data: [
            {
              line_items: [
                { item: "setup_fee", amount: 500000 },
                { item: "subscription_charge", amount: 99900 },
              ],
            },
          ],
          error: null,
          count: 1,
        });
      return thenable({ data: null, error: null });
    });
    const res = await postCreate({ tier: "growth", cycle: "monthly" });
    expect(res.status).toBe(200);
    expect((await res.json()).amount).toBe(99900);
  });

  it("does not charge setup on the first annual order", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "subscriptions")
        return thenable({
          data: { plan: "free", plan_price: null, expiry_date: null },
          error: null,
        });
      if (table === "institutes")
        return thenable({ data: { owner_id: OWNER }, error: null });
      if (table === "students")
        return thenable({ data: null, error: null, count: 10 });
      if (table === "billing_orders")
        return thenable({ data: null, error: null, count: 0 });
      return thenable({ data: null, error: null });
    });
    const res = await postCreate({ tier: "growth", cycle: "annual" });
    expect(res.status).toBe(200);
    expect((await res.json()).amount).toBe(1000000);
  });

  it("refuses a different tier while more than 7 days remain", async () => {
    process.env.VITE_CONTACT_WHATSAPP = "919876543210";
    const later = new Date(Date.now() + 30 * 86400_000).toISOString();
    fromMock.mockImplementation((table: string) => {
      if (table === "subscriptions")
        return thenable({
          data: { plan: "starter", plan_price: 499, expiry_date: later },
          error: null,
        });
      if (table === "institutes")
        return thenable({ data: { owner_id: OWNER }, error: null });
      return thenable({ data: null, error: null, count: 0 });
    });
    const res = await postCreate({ tier: "large", cycle: "monthly" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("TIER_CHANGE_CONTACT_SUPPORT");
    expect(body.message).toMatch(/WhatsApp/i);
    expect(body.contactLink).toBe("https://wa.me/919876543210");
  });

  it("409 without WhatsApp says contact us and uses mailto", async () => {
    delete process.env.VITE_CONTACT_WHATSAPP;
    process.env.VITE_CONTACT_EMAIL = "support@example.com";
    const later = new Date(Date.now() + 30 * 86400_000).toISOString();
    fromMock.mockImplementation((table: string) => {
      if (table === "subscriptions")
        return thenable({
          data: { plan: "starter", plan_price: 499, expiry_date: later },
          error: null,
        });
      if (table === "institutes")
        return thenable({ data: { owner_id: OWNER }, error: null });
      return thenable({ data: null, error: null, count: 0 });
    });
    const res = await postCreate({ tier: "large", cycle: "monthly" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).not.toMatch(/WhatsApp/i);
    expect(body.message).toMatch(/contact us/i);
    expect(body.contactLink).toBe("mailto:support@example.com");
  });

  it("allows a different tier with exactly 7 days left", async () => {
    const in7 = new Date(Date.now() + 7 * 86400_000).toISOString();
    fromMock.mockImplementation((table: string) => {
      if (table === "subscriptions")
        return thenable({
          data: { plan: "starter", plan_price: 499, expiry_date: in7 },
          error: null,
        });
      if (table === "institutes")
        return thenable({ data: { owner_id: OWNER }, error: null });
      if (table === "students")
        return thenable({ data: null, error: null, count: 10 });
      if (table === "billing_orders")
        return thenable({ data: null, error: null, count: 1 });
      return thenable({ data: null, error: null });
    });
    const res = await postCreate({ tier: "large", cycle: "monthly" });
    expect(res.status).toBe(200);
  });

  it("allows a different tier when expired", async () => {
    const expired = new Date(Date.now() - 86400_000).toISOString();
    fromMock.mockImplementation((table: string) => {
      if (table === "subscriptions")
        return thenable({
          data: { plan: "starter", plan_price: 499, expiry_date: expired },
          error: null,
        });
      if (table === "institutes")
        return thenable({ data: { owner_id: OWNER }, error: null });
      if (table === "students")
        return thenable({ data: null, error: null, count: 10 });
      if (table === "billing_orders")
        return thenable({ data: null, error: null, count: 1 });
      return thenable({ data: null, error: null });
    });
    const res = await postCreate({ tier: "large", cycle: "monthly" });
    expect(res.status).toBe(200);
  });

  it("allows same-tier renewal while time remains", async () => {
    const later = new Date(Date.now() + 30 * 86400_000).toISOString();
    fromMock.mockImplementation((table: string) => {
      if (table === "subscriptions")
        return thenable({
          data: { plan: "growth", plan_price: 999, expiry_date: later },
          error: null,
        });
      if (table === "institutes")
        return thenable({ data: { owner_id: OWNER }, error: null });
      if (table === "students")
        return thenable({ data: null, error: null, count: 10 });
      if (table === "billing_orders")
        return thenable({ data: null, error: null, count: 1 });
      return thenable({ data: null, error: null });
    });
    const res = await postCreate({ tier: "growth", cycle: "monthly" });
    expect(res.status).toBe(200);
  });

  it("returns 503 when billing is disabled", async () => {
    disableBilling();
    const res = await postCreate({ tier: "growth", cycle: "monthly" });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("BILLING_DISABLED");
  });

  it("charges setup to a non-free plan unless the admin toggle is on", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "subscriptions")
        return thenable({
          data: {
            plan: "growth",
            plan_price: 999,
            expiry_date: "2026-12-01",
            setup_fee_paid: false,
          },
          error: null,
        });
      if (table === "institutes")
        return thenable({ data: { owner_id: OWNER }, error: null });
      if (table === "students")
        return thenable({ data: null, error: null, count: 10 });
      if (table === "billing_orders")
        return thenable({ data: [], error: null, count: 0 });
      return thenable({ data: null, error: null });
    });
    const res = await postCreate({ tier: "growth", cycle: "monthly" });
    expect(res.status).toBe(200);
    expect((await res.json()).amount).toBe(599900);
  });

  it("skips setup when the admin toggle marks it paid (offline invoice)", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "subscriptions")
        return thenable({
          data: {
            plan: "growth",
            plan_price: 999,
            expiry_date: "2026-12-01",
            setup_fee_paid: true,
          },
          error: null,
        });
      if (table === "institutes")
        return thenable({ data: { owner_id: OWNER }, error: null });
      if (table === "students")
        return thenable({ data: null, error: null, count: 10 });
      if (table === "billing_orders")
        return thenable({ data: [], error: null, count: 0 });
      return thenable({ data: null, error: null });
    });
    const res = await postCreate({ tier: "growth", cycle: "monthly" });
    expect(res.status).toBe(200);
    expect((await res.json()).amount).toBe(99900);
  });

  it("blocks buying a tier below the active student count", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "subscriptions")
        return thenable({
          data: { plan: "free", plan_price: null, expiry_date: null },
          error: null,
        });
      if (table === "institutes")
        return thenable({ data: { owner_id: OWNER }, error: null });
      if (table === "students")
        return thenable({ data: null, error: null, count: 300 });
      return thenable({ data: null, error: null, count: 0 });
    });
    const res = await postCreate({ tier: "starter", cycle: "monthly" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("OVER_TIER_LIMIT");
  });
});

describe("POST /api/billing/verify-payment", () => {
  beforeEach(() => {
    enableBilling();
    parseBearerMock.mockResolvedValue({ ok: true, userId: OWNER });
    fromMock.mockReset();
    rpcMock.mockReset();
    paymentsFetch.mockReset();
  });
  afterEach(() => disableBilling());

  async function postVerify(body: unknown) {
    const { Route } = await import("@/routes/api/billing/verify-payment");
    return handlerOf(
      Route,
      "POST",
    )(
      jsonReq("http://localhost/api/billing/verify-payment", body, {
        Authorization: "Bearer tok",
      }),
    );
  }

  const storedOrder = {
    id: ORDER_UUID,
    owner_id: OWNER,
    razorpay_order_id: RZ_ORDER,
    amount_paise: 99900,
    currency: "INR",
  };

  it("returns 400 on a bad signature", async () => {
    const res = await postVerify({
      razorpay_order_id: RZ_ORDER,
      razorpay_payment_id: RZ_PAY,
      razorpay_signature: "deadbeef",
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SIGNATURE");
  });

  it("returns 500 when order lookup hits a DB error", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "billing_orders")
        return thenable({ data: null, error: { message: "db down" } });
      return thenable({ data: null, error: null });
    });
    const res = await postVerify({
      razorpay_order_id: RZ_ORDER,
      razorpay_payment_id: RZ_PAY,
      razorpay_signature: checkoutSig(RZ_ORDER, RZ_PAY),
    });
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("DB_ERROR");
  });

  it("returns 200 needsReview when activation holds a mid-term tier change", async () => {
    fromMock.mockImplementation(() =>
      thenable({ data: storedOrder, error: null }),
    );
    paymentsFetch.mockResolvedValue({
      id: RZ_PAY,
      order_id: RZ_ORDER,
      status: "captured",
      amount: 99900,
      currency: "INR",
    });
    rpcMock.mockResolvedValue({
      data: {
        activated: false,
        reason: "tier_change_needs_review",
        needs_review: true,
        owner_id: OWNER,
        tier: "large",
        cycle: "monthly",
      },
      error: null,
    });
    const res = await postVerify({
      razorpay_order_id: RZ_ORDER,
      razorpay_payment_id: RZ_PAY,
      razorpay_signature: checkoutSig(RZ_ORDER, RZ_PAY),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.needsReview).toBe(true);
    expect(body.message).toMatch(/We'll contact you to switch your plan/i);
  });

  it("returns needsReview when webhook holds between order fetch and activate", async () => {
    fromMock.mockImplementation(() =>
      thenable({ data: storedOrder, error: null }),
    );
    paymentsFetch.mockResolvedValue({
      id: RZ_PAY,
      order_id: RZ_ORDER,
      status: "captured",
      amount: 99900,
      currency: "INR",
    });
    rpcMock.mockResolvedValue({
      data: {
        activated: false,
        reason: "already_activated",
        needs_review: true,
      },
      error: null,
    });
    const res = await postVerify({
      razorpay_order_id: RZ_ORDER,
      razorpay_payment_id: RZ_PAY,
      razorpay_signature: checkoutSig(RZ_ORDER, RZ_PAY),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.needsReview).toBe(true);
    expect(body.message).toMatch(/We'll contact you to switch your plan/i);
  });

  it("returns needsReview when the webhook held the order first (already_activated)", async () => {
    fromMock.mockImplementation(() =>
      thenable({
        data: { ...storedOrder, needs_review: true },
        error: null,
      }),
    );
    paymentsFetch.mockResolvedValue({
      id: RZ_PAY,
      order_id: RZ_ORDER,
      status: "captured",
      amount: 99900,
      currency: "INR",
    });
    rpcMock.mockResolvedValue({
      data: {
        activated: false,
        reason: "already_activated",
        needs_review: true,
      },
      error: null,
    });
    const res = await postVerify({
      razorpay_order_id: RZ_ORDER,
      razorpay_payment_id: RZ_PAY,
      razorpay_signature: checkoutSig(RZ_ORDER, RZ_PAY),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.needsReview).toBe(true);
  });

  it("returns needsReview from the order row even if RPC drops the flag", async () => {
    fromMock.mockImplementation(() =>
      thenable({
        data: { ...storedOrder, needs_review: true },
        error: null,
      }),
    );
    paymentsFetch.mockResolvedValue({
      id: RZ_PAY,
      order_id: RZ_ORDER,
      status: "captured",
      amount: 99900,
      currency: "INR",
    });
    rpcMock.mockResolvedValue({
      data: { activated: false, reason: "already_activated" },
      error: null,
    });
    const res = await postVerify({
      razorpay_order_id: RZ_ORDER,
      razorpay_payment_id: RZ_PAY,
      razorpay_signature: checkoutSig(RZ_ORDER, RZ_PAY),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).needsReview).toBe(true);
  });

  it("returns alreadyProcessed when a dismissed hold is verified again", async () => {
    fromMock.mockImplementation(() =>
      thenable({
        data: {
          ...storedOrder,
          needs_review: false,
          review_reason:
            "Paid large monthly order captured while current paid plan is starter",
        },
        error: null,
      }),
    );
    paymentsFetch.mockResolvedValue({
      id: RZ_PAY,
      order_id: RZ_ORDER,
      status: "captured",
      amount: 99900,
      currency: "INR",
    });
    rpcMock.mockResolvedValue({
      data: {
        activated: false,
        reason: "already_activated",
        needs_review: false,
      },
      error: null,
    });
    const res = await postVerify({
      razorpay_order_id: RZ_ORDER,
      razorpay_payment_id: RZ_PAY,
      razorpay_signature: checkoutSig(RZ_ORDER, RZ_PAY),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.needsReview).toBeUndefined();
    expect(body.alreadyProcessed).toBe(true);
    expect(body.message).toBe("Payment already processed");
  });

  it("returns 404 for the wrong owner", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "billing_orders")
        return thenable({ data: null, error: null });
      return thenable({ data: null, error: null });
    });
    const res = await postVerify({
      razorpay_order_id: RZ_ORDER,
      razorpay_payment_id: RZ_PAY,
      razorpay_signature: checkoutSig(RZ_ORDER, RZ_PAY),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 on amount mismatch", async () => {
    fromMock.mockImplementation(() =>
      thenable({ data: storedOrder, error: null }),
    );
    paymentsFetch.mockResolvedValue({
      id: RZ_PAY,
      order_id: RZ_ORDER,
      status: "captured",
      amount: 1,
      currency: "INR",
    });
    const res = await postVerify({
      razorpay_order_id: RZ_ORDER,
      razorpay_payment_id: RZ_PAY,
      razorpay_signature: checkoutSig(RZ_ORDER, RZ_PAY),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("AMOUNT_MISMATCH");
  });

  it("returns pending for authorized payments and does not activate", async () => {
    fromMock.mockImplementation(() =>
      thenable({ data: storedOrder, error: null }),
    );
    paymentsFetch.mockResolvedValue({
      id: RZ_PAY,
      order_id: RZ_ORDER,
      status: "authorized",
      amount: 99900,
      currency: "INR",
    });
    const res = await postVerify({
      razorpay_order_id: RZ_ORDER,
      razorpay_payment_id: RZ_PAY,
      razorpay_signature: checkoutSig(RZ_ORDER, RZ_PAY),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("pending");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("activates once; a later webhook for the same order is already_activated", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "billing_orders")
        return thenable({ data: storedOrder, error: null });
      if (table === "razorpay_webhook_deliveries")
        return thenable({ data: { handled: false }, error: null });
      return thenable({ data: null, error: null });
    });
    paymentsFetch.mockResolvedValue({
      id: RZ_PAY,
      order_id: RZ_ORDER,
      status: "captured",
      amount: 99900,
      currency: "INR",
    });
    rpcMock
      .mockResolvedValueOnce({
        data: {
          activated: true,
          owner_id: OWNER,
          tier: "growth",
          cycle: "monthly",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { activated: false, reason: "already_activated" },
        error: null,
      });

    const verifyRes = await postVerify({
      razorpay_order_id: RZ_ORDER,
      razorpay_payment_id: RZ_PAY,
      razorpay_signature: checkoutSig(RZ_ORDER, RZ_PAY),
    });
    expect(verifyRes.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledTimes(1);

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: RZ_PAY,
            order_id: RZ_ORDER,
            amount: 99900,
            currency: "INR",
            status: "captured",
            method: "card",
          },
        },
      },
    };
    const raw = JSON.stringify(payload);
    const { Route: WebhookRoute } =
      await import("@/routes/api/webhooks/razorpay");
    const hookRes = await handlerOf(
      WebhookRoute,
      "POST",
    )(
      new Request("http://localhost/api/webhooks/razorpay", {
        method: "POST",
        headers: {
          "x-razorpay-signature": webhookSig(raw),
          "x-razorpay-event-id": "evt_1",
        },
        body: raw,
      }),
    );
    expect(hookRes.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });
});

describe("POST /api/webhooks/razorpay", () => {
  beforeEach(() => {
    enableBilling();
    fromMock.mockReset();
    rpcMock.mockReset();
  });
  afterEach(() => disableBilling());

  async function postHook(
    payload: unknown,
    opts: { sig?: string; eventId?: string } = {},
  ) {
    const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
    const { Route } = await import("@/routes/api/webhooks/razorpay");
    return handlerOf(
      Route,
      "POST",
    )(
      new Request("http://localhost/api/webhooks/razorpay", {
        method: "POST",
        headers: {
          "x-razorpay-signature": opts.sig ?? webhookSig(raw),
          "x-razorpay-event-id": opts.eventId ?? "evt_new",
        },
        body: raw,
      }),
    );
  }

  const paymentEntity = {
    id: RZ_PAY,
    order_id: RZ_ORDER,
    amount: 99900,
    currency: "INR",
    status: "captured",
    method: "card",
  };

  it("returns 400 on a bad signature", async () => {
    const res = await postHook(
      {
        event: "payment.captured",
        payload: { payment: { entity: paymentEntity } },
      },
      { sig: "00".repeat(32) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 already_handled for a duplicate event id", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "razorpay_webhook_deliveries")
        return thenable({ data: { handled: true }, error: null });
      return thenable({ data: null, error: null });
    });
    const res = await postHook({
      event: "payment.captured",
      payload: { payment: { entity: paymentEntity } },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reason).toBe("already_handled");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("activates from payment.captured using payload.payment.entity", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "razorpay_webhook_deliveries")
        return thenable({ data: { handled: false }, error: null });
      if (table === "billing_orders")
        return thenable({
          data: {
            id: ORDER_UUID,
            amount_paise: 99900,
            currency: "INR",
          },
          error: null,
        });
      return thenable({ data: null, error: null });
    });
    rpcMock.mockResolvedValue({
      data: {
        activated: true,
        owner_id: OWNER,
        tier: "growth",
        cycle: "monthly",
      },
      error: null,
    });
    const res = await postHook({
      event: "payment.captured",
      payload: { payment: { entity: paymentEntity } },
    });
    expect(res.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith(
      "activate_billing_order",
      expect.objectContaining({
        _order_id: ORDER_UUID,
        _payment_id: RZ_PAY,
        _amount: 99900,
        _currency: "INR",
      }),
    );
  });

  it("activates from order.paid using payload.payment.entity", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "razorpay_webhook_deliveries")
        return thenable({ data: { handled: false }, error: null });
      if (table === "billing_orders")
        return thenable({
          data: { id: ORDER_UUID, amount_paise: 99900, currency: "INR" },
          error: null,
        });
      return thenable({ data: null, error: null });
    });
    rpcMock.mockResolvedValue({
      data: {
        activated: true,
        owner_id: OWNER,
        tier: "growth",
        cycle: "monthly",
      },
      error: null,
    });
    const res = await postHook({
      event: "order.paid",
      payload: {
        payment: { entity: paymentEntity },
        order: { entity: { id: RZ_ORDER } },
      },
    });
    expect(res.status).toBe(200);
    expect(rpcMock).toHaveBeenCalled();
  });

  it("returns 200 for an unknown order id (other environment)", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "razorpay_webhook_deliveries")
        return thenable({ data: { handled: false }, error: null });
      if (table === "billing_orders")
        return thenable({ data: null, error: null });
      return thenable({ data: null, error: null });
    });
    const res = await postHook({
      event: "payment.captured",
      payload: { payment: { entity: paymentEntity } },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.reason).toBe("order_not_found");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns 500 when order lookup hits a DB error", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "razorpay_webhook_deliveries")
        return thenable({ data: { handled: false }, error: null });
      if (table === "billing_orders")
        return thenable({ data: null, error: { message: "db down" } });
      return thenable({ data: null, error: null });
    });
    const res = await postHook({
      event: "payment.captured",
      payload: { payment: { entity: paymentEntity } },
    });
    expect(res.status).toBe(500);
  });

  it("webhook-only path activates when verify never ran", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "razorpay_webhook_deliveries")
        return thenable({ data: { handled: false }, error: null });
      if (table === "billing_orders")
        return thenable({
          data: { id: ORDER_UUID, amount_paise: 99900, currency: "INR" },
          error: null,
        });
      return thenable({ data: null, error: null });
    });
    rpcMock.mockResolvedValue({
      data: {
        activated: true,
        owner_id: OWNER,
        tier: "starter",
        cycle: "annual",
      },
      error: null,
    });
    const res = await postHook({
      event: "payment.captured",
      payload: { payment: { entity: paymentEntity } },
    });
    expect(res.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
});
