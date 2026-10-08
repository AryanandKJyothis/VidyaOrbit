import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_D = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_T = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ORDER_A = "11111111-1111-4111-8111-111111111111";
const ORDER_B = "22222222-2222-4222-8222-222222222222";
const ORDER_D = "33333333-3333-4333-8333-333333333333";
const ORDER_T1 = "44444444-4444-4444-8444-444444444444";
const ORDER_T2 = "55555555-5555-4555-8555-555555555555";
const SETUP_ITEMS = JSON.stringify([
  { item: "setup_fee", amount: 500000 },
  { item: "subscription_charge", amount: 99900 },
]);
const LARGE_SETUP_ITEMS = JSON.stringify([
  { item: "setup_fee", amount: 500000 },
  { item: "subscription_charge", amount: 249900 },
]);

const STUB = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT 'service_role';
$$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULL::uuid;
$$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TYPE public.plan_code AS ENUM ('free', 'starter', 'growth', 'pro');
CREATE TABLE public.subscriptions (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id),
  plan public.plan_code NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  start_date timestamptz,
  expiry_date timestamptz,
  plan_price numeric(10,2),
  notes text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  status text
);
CREATE OR REPLACE FUNCTION public.current_plan(_uid uuid)
RETURNS public.plan_code LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT plan FROM public.subscriptions WHERE owner_id = _uid LIMIT 1),
    'free'::public.plan_code);
$$;
CREATE OR REPLACE FUNCTION public.is_workspace_member(_owner uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false; $$;
CREATE OR REPLACE FUNCTION public.apply_subscription_change(
  _owner uuid, _changed_by uuid, _plan public.plan_code, _status text,
  _start timestamptz, _expiry timestamptz, _price numeric,
  _notes text, _note text, _confirm boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.subscriptions
    (owner_id, plan, status, start_date, expiry_date, plan_price, notes)
  VALUES (_owner, _plan, _status, _start, _expiry, _price, _notes)
  ON CONFLICT (owner_id) DO UPDATE SET
    plan = EXCLUDED.plan, status = EXCLUDED.status,
    start_date = EXCLUDED.start_date, expiry_date = EXCLUDED.expiry_date,
    plan_price = EXCLUDED.plan_price, notes = EXCLUDED.notes;
  RETURN jsonb_build_object('ok', true);
END;
$$;
`;

function load(name: string) {
  return readFileSync(`supabase/migrations/${name}`, "utf8");
}

describe("activate_billing_order (PGlite)", () => {
  let db: PGlite;

  async function activate(
    id: string,
    pay: string,
    amount: number,
    currency = "INR",
  ) {
    const r = await db.query<{ j: Record<string, unknown> }>(
      `SELECT public.activate_billing_order($1::uuid, $2, $3::bigint, $4) AS j`,
      [id, pay, amount, currency],
    );
    return r.rows[0].j;
  }

  async function insertOrder(args: {
    id: string;
    owner: string;
    rz: string;
    amount: number;
    tier: string;
    cycle: string;
    items: string;
    keyMode: "test" | "live";
  }) {
    await db.query(
      `INSERT INTO public.billing_orders
        (id, owner_id, razorpay_order_id, intent, amount_paise, currency,
         status, line_items, tier, cycle, key_mode)
       VALUES ($1,$2,$3,$4,$5,'INR','created',$6::jsonb,$7,$8,$9)`,
      [
        args.id,
        args.owner,
        args.rz,
        `${args.tier}_${args.cycle}`,
        args.amount,
        args.items,
        args.tier,
        args.cycle,
        args.keyMode,
      ],
    );
  }

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(STUB);
    await db.exec(load("20261008091800_create_billing_orders_table.sql"));
    await db.exec(load("20261008093000_pro_plan_unlimited.sql"));
    await db.exec(load("20261008094000_atomic_billing_activation.sql"));
    for (const id of [OWNER, OWNER_D, OWNER_T]) {
      await db.query(`INSERT INTO auth.users (id) VALUES ($1)`, [id]);
      await db.query(
        `INSERT INTO public.subscriptions (owner_id, plan, status)
         VALUES ($1, 'free', 'active')`,
        [id],
      );
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it("runs T1 race, key_mode, and 094000 re-run", async () => {
    // (a) first live order with setup is NOT flagged
    await insertOrder({
      id: ORDER_B,
      owner: OWNER,
      rz: "order_b",
      amount: 599900,
      tier: "growth",
      cycle: "monthly",
      items: SETUP_ITEMS,
      keyMode: "live",
    });
    const first = await activate(ORDER_B, "pay_b", 599900);
    expect(first.activated).toBe(true);
    expect(first.needs_review ?? false).toBe(false);
    const afterB = await db.query<{
      setup_fee_paid: boolean;
      expiry_date: string;
      plan: string;
    }>(
      `SELECT setup_fee_paid, expiry_date::text, plan::text
         FROM public.subscriptions WHERE owner_id = $1`,
      [OWNER],
    );
    expect(afterB.rows[0].setup_fee_paid).toBe(true);
    expect(afterB.rows[0].plan).toBe("growth");
    const expiryB = afterB.rows[0].expiry_date;

    // (b) A created, B already captured, then A captured → flagged, plan extended
    await insertOrder({
      id: ORDER_A,
      owner: OWNER,
      rz: "order_a",
      amount: 599900,
      tier: "growth",
      cycle: "monthly",
      items: SETUP_ITEMS,
      keyMode: "live",
    });
    const second = await activate(ORDER_A, "pay_a", 599900);
    expect(second.activated).toBe(true);
    expect(second.reason).toBe("setup_already_paid");
    const orderA = await db.query<{
      needs_review: boolean;
      review_reason: string;
    }>(
      `SELECT needs_review, review_reason FROM public.billing_orders WHERE id = $1`,
      [ORDER_A],
    );
    expect(orderA.rows[0].needs_review).toBe(true);
    expect(orderA.rows[0].review_reason).toMatch(/setup_already_paid/);
    const afterA = await db.query<{ expiry_date: string; plan: string }>(
      `SELECT expiry_date::text, plan::text FROM public.subscriptions WHERE owner_id = $1`,
      [OWNER],
    );
    expect(afterA.rows[0].plan).toBe("growth");
    expect(afterA.rows[0].expiry_date > expiryB).toBe(true);

    // (c) replay B → already_activated, expiry unchanged
    const replay = await activate(ORDER_B, "pay_b", 599900);
    expect(replay.activated).toBe(false);
    expect(replay.reason).toBe("already_activated");
    const afterReplay = await db.query<{ expiry_date: string }>(
      `SELECT expiry_date::text FROM public.subscriptions WHERE owner_id = $1`,
      [OWNER],
    );
    expect(afterReplay.rows[0].expiry_date).toBe(afterA.rows[0].expiry_date);

    // (d) tier hold + duplicate setup: both reasons, plan untouched
    await db.query(
      `UPDATE public.subscriptions
          SET plan = 'starter', plan_price = 499,
              expiry_date = now() + interval '30 days', setup_fee_paid = true
        WHERE owner_id = $1`,
      [OWNER_D],
    );
    const beforeD = await db.query<{ expiry_date: string; plan: string }>(
      `SELECT expiry_date::text, plan::text FROM public.subscriptions WHERE owner_id = $1`,
      [OWNER_D],
    );
    await insertOrder({
      id: ORDER_D,
      owner: OWNER_D,
      rz: "order_d",
      amount: 749900,
      tier: "large",
      cycle: "monthly",
      items: LARGE_SETUP_ITEMS,
      keyMode: "live",
    });
    const held = await activate(ORDER_D, "pay_d", 749900);
    expect(held.activated).toBe(false);
    expect(held.reason).toBe("tier_change_needs_review");
    const orderD = await db.query<{ review_reason: string }>(
      `SELECT review_reason FROM public.billing_orders WHERE id = $1`,
      [ORDER_D],
    );
    expect(orderD.rows[0].review_reason).toMatch(/Not applied/);
    expect(orderD.rows[0].review_reason).toMatch(/setup_already_paid/);
    const afterD = await db.query<{ expiry_date: string; plan: string }>(
      `SELECT expiry_date::text, plan::text FROM public.subscriptions WHERE owner_id = $1`,
      [OWNER_D],
    );
    expect(afterD.rows[0].plan).toBe("starter");
    expect(afterD.rows[0].expiry_date).toBe(beforeD.rows[0].expiry_date);

    // key_mode: test capture does not set the flag or waive the next live setup
    await insertOrder({
      id: ORDER_T1,
      owner: OWNER_T,
      rz: "order_t1",
      amount: 599900,
      tier: "growth",
      cycle: "monthly",
      items: SETUP_ITEMS,
      keyMode: "test",
    });
    const testCap = await activate(ORDER_T1, "pay_t1", 599900);
    expect(testCap.activated).toBe(true);
    expect(testCap.needs_review ?? false).toBe(false);
    const afterTest = await db.query<{ setup_fee_paid: boolean }>(
      `SELECT setup_fee_paid FROM public.subscriptions WHERE owner_id = $1`,
      [OWNER_T],
    );
    expect(afterTest.rows[0].setup_fee_paid).toBe(false);

    await insertOrder({
      id: ORDER_T2,
      owner: OWNER_T,
      rz: "order_t2",
      amount: 599900,
      tier: "growth",
      cycle: "monthly",
      items: SETUP_ITEMS,
      keyMode: "live",
    });
    const liveAfterTest = await activate(ORDER_T2, "pay_t2", 599900);
    expect(liveAfterTest.activated).toBe(true);
    expect(liveAfterTest.reason ?? null).not.toBe("setup_already_paid");
    const afterLive = await db.query<{ setup_fee_paid: boolean }>(
      `SELECT setup_fee_paid FROM public.subscriptions WHERE owner_id = $1`,
      [OWNER_T],
    );
    expect(afterLive.rows[0].setup_fee_paid).toBe(true);

    // (e) re-running 094000 keeps flags
    await db.exec(load("20261008094000_atomic_billing_activation.sql"));
    const kept = await db.query<{
      setup_fee_paid: boolean;
      needs_review: boolean;
    }>(
      `SELECT s.setup_fee_paid, o.needs_review
         FROM public.subscriptions s
         JOIN public.billing_orders o ON o.owner_id = s.owner_id
        WHERE o.id = $1`,
      [ORDER_A],
    );
    expect(kept.rows[0].setup_fee_paid).toBe(true);
    expect(kept.rows[0].needs_review).toBe(true);
  });
});
