import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PUBLIC_RECEIPT_KEYS,
  PUBLIC_REPORT_KEYS,
  PUBLIC_SHARE_FORBIDDEN_KEYS,
} from "./share-links";

const OWNER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STAFF_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STUDENT_A = "11111111-1111-4111-8111-111111111111";
const STUDENT_B = "22222222-2222-4222-8222-222222222222";
const STUDENT_C = "33333333-3333-4333-8333-333333333333";
const PAYMENT_A = "44444444-4444-4444-8444-444444444444";
const PAYMENT_B = "55555555-5555-4555-8555-555555555555";
const BATCH_A = "66666666-6666-4666-8666-666666666666";
const SESSION_A = "77777777-7777-4777-8777-777777777777";

const STUB = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('test.role', true), ''), 'authenticated');
$$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('test.uid', true), '')::uuid;
$$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.institutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  contact_phone text,
  contact_email text,
  address text
);
CREATE TABLE public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL
);
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  full_name text NOT NULL,
  phone text,
  guardian_phone text,
  batch_id uuid,
  fee_total numeric,
  status text DEFAULT 'active'
);
CREATE TABLE public.fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  student_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  method text NOT NULL DEFAULT 'cash',
  receipt_number text,
  notes text
);
CREATE TABLE public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  batch_id uuid,
  session_date date NOT NULL
);
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  status text NOT NULL
);

CREATE OR REPLACE FUNCTION public.has_resource_access(
  _owner uuid, _uid uuid, _resource text, _write boolean
) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _uid = _owner THEN RETURN true; END IF;
  IF _uid = '${STAFF_A}' AND _owner = '${OWNER_A}' THEN RETURN true; END IF;
  RETURN false;
END;
$$;
`;

function loadMigration() {
  return readFileSync(
    "supabase/migrations/20261015120000_shareable_receipts_and_reports.sql",
    "utf8",
  );
}

function loadA7Migration() {
  return readFileSync(
    "supabase/migrations/20261025100000_harden_public_share_links.sql",
    "utf8",
  );
}

describe("public share RPCs (PGlite)", () => {
  let db: PGlite;
  let ipSeq = 0;

  async function asUser(uid: string | null, role = "authenticated") {
    await db.exec(`SELECT set_config('test.uid', '${uid ?? ""}', false)`);
    await db.exec(`SELECT set_config('test.role', '${role}', false)`);
  }

  async function setClient(ip?: string, ua = "VidyaOrbit-PGlite/1.0") {
    const clientIp = ip ?? `203.0.113.${(ipSeq++ % 200) + 1}`;
    await db.query(`SELECT set_config('request.headers', $1, false)`, [
      JSON.stringify({ "x-real-ip": clientIp, "user-agent": ua }),
    ]);
    return clientIp;
  }

  async function receipt(token: string, ip?: string) {
    await setClient(ip);
    const r = await db.query<{ j: Record<string, unknown> }>(
      `SELECT public.get_public_receipt($1) AS j`,
      [token],
    );
    return r.rows[0].j;
  }

  async function report(token: string, ip?: string) {
    await setClient(ip);
    const r = await db.query<{ j: Record<string, unknown> }>(
      `SELECT public.get_public_report($1) AS j`,
      [token],
    );
    return r.rows[0].j;
  }

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(STUB);
    const migration = loadMigration().replace(
      /CREATE EXTENSION IF NOT EXISTS pgcrypto;/g,
      "-- pgcrypto unavailable in PGlite; generate_share_token falls back",
    );
    await db.exec(migration);
    await db.exec(loadA7Migration());

    await db.query(`INSERT INTO auth.users (id) VALUES ($1), ($2), ($3)`, [
      OWNER_A,
      OWNER_B,
      STAFF_A,
    ]);
    await db.query(
      `INSERT INTO public.institutes (owner_id, name, contact_phone, contact_email, address)
       VALUES ($1, 'Orbit Coaching', '9876500000', 'a@centre.test', 'Valanchery'),
              ($2, 'Other Centre', '9000000000', 'b@other.test', 'Secret lane')`,
      [OWNER_A, OWNER_B],
    );
    await db.query(
      `INSERT INTO public.batches (id, owner_id, name) VALUES ($1, $2, 'Class 10 Maths')`,
      [BATCH_A, OWNER_A],
    );
    await db.query(
      `INSERT INTO public.students
        (id, owner_id, full_name, phone, guardian_phone, batch_id, fee_total)
       VALUES
        ($1, $2, 'Amina', '9111111111', '9222222222', $3, 2500),
        ($4, $2, 'Other Student', '9333333333', '9444444444', $3, 3000),
        ($5, $6, 'Cross Tenant', '9555555555', '9666666666', NULL, 1000)`,
      [STUDENT_A, OWNER_A, BATCH_A, STUDENT_B, STUDENT_C, OWNER_B],
    );
    await db.query(
      `INSERT INTO public.fee_payments
        (id, owner_id, student_id, amount, payment_date, method, receipt_number, notes)
       VALUES
        ($1, $2, $3, 2500, '2026-10-05', 'upi', 'RCT-2026-00012', 'keep private'),
        ($4, $5, $6, 900, '2026-10-06', 'cash', 'RCT-OTHER-1', 'other notes')`,
      [PAYMENT_A, OWNER_A, STUDENT_A, PAYMENT_B, OWNER_B, STUDENT_C],
    );
    await db.query(
      `INSERT INTO public.attendance_sessions (id, owner_id, batch_id, session_date)
       VALUES ($1, $2, $3, '2026-10-06')`,
      [SESSION_A, OWNER_A, BATCH_A],
    );
    await db.query(
      `INSERT INTO public.attendance_records (owner_id, session_id, student_id, status)
       VALUES ($1, $2, $3, 'present'), ($1, $2, $4, 'absent')`,
      [OWNER_A, SESSION_A, STUDENT_A, STUDENT_B],
    );
  });

  afterAll(async () => {
    await db?.close();
  });

  it("creates a 128-bit-or-more token on insert, not the payment id", async () => {
    const row = await db.query<{ share_token: string }>(
      `SELECT share_token FROM public.receipt_shares WHERE payment_id = $1`,
      [PAYMENT_A],
    );
    const token = row.rows[0].share_token;
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).not.toBe(PAYMENT_A.replace(/-/g, ""));
    expect(token).not.toBe(PAYMENT_A);
  });

  it("returns only receipt fields and hides phones and the other student", async () => {
    await asUser(null, "anon");
    const token = (
      await db.query<{ share_token: string }>(
        `SELECT share_token FROM public.receipt_shares WHERE payment_id = $1`,
        [PAYMENT_A],
      )
    ).rows[0].share_token;
    const payload = await receipt(token);
    expect(payload.ok).toBe(true);
    expect(payload.student_name).toBe("Amina");
    expect(payload.centre_name).toBe("Orbit Coaching");
    expect(payload.receipt_number).toBe("RCT-2026-00012");
    expect(Number(payload.amount)).toBe(2500);
    expect(payload.payment_mode).toBe("upi");
    expect(payload.status).toBe("Paid");
    expect(String(payload.period)).toMatch(/October 2026/i);
    expect(Object.keys(payload).sort()).toEqual(
      [...PUBLIC_RECEIPT_KEYS].sort(),
    );
    const blob = JSON.stringify(payload);
    for (const key of PUBLIC_SHARE_FORBIDDEN_KEYS) {
      expect(blob).not.toContain(key);
    }
    expect(blob).not.toContain("9111111111");
    expect(blob).not.toContain("9222222222");
    expect(blob).not.toContain("Other Student");
    expect(blob).not.toContain("Cross Tenant");
    expect(blob).not.toContain("Other Centre");
    expect(blob).not.toContain("keep private");
  });

  it("fails closed for a revoked receipt token and for a sequential id", async () => {
    await asUser(OWNER_A);
    await db.query(`SELECT public.revoke_receipt_share($1)`, [PAYMENT_A]);
    const token = (
      await db.query<{ share_token: string }>(
        `SELECT share_token FROM public.receipt_shares WHERE payment_id = $1`,
        [PAYMENT_A],
      )
    ).rows[0].share_token;
    await asUser(null, "anon");
    expect(await receipt(token)).toEqual({ ok: false, reason: "revoked" });
    expect(await receipt(PAYMENT_A)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await receipt("1")).toEqual({ ok: false, reason: "not_found" });

    await asUser(OWNER_A);
    const regen = await db.query<{ j: Record<string, unknown> }>(
      `SELECT public.regenerate_receipt_share($1) AS j`,
      [PAYMENT_A],
    );
    const next = String(regen.rows[0].j.token);
    expect(next).not.toBe(token);
    await asUser(null, "anon");
    expect((await receipt(token)).ok).toBe(false);
    expect((await receipt(next)).ok).toBe(true);
  });

  it("report RPC hides phones, other students, and fails after revoke", async () => {
    await asUser(OWNER_A);
    const issued = await db.query<{ j: Record<string, unknown> }>(
      `SELECT public.issue_report_share($1, '2026-10-01', 'Good work') AS j`,
      [STUDENT_A],
    );
    const token = String(issued.rows[0].j.token);
    await asUser(null, "anon");
    const payload = await report(token);
    expect(payload.ok).toBe(true);
    expect(payload.student_name).toBe("Amina");
    expect(payload.centre_name).toBe("Orbit Coaching");
    expect(Number(payload.days_present)).toBe(1);
    expect(Number(payload.days_absent)).toBe(0);
    expect(payload.fee_status).toBe("paid");
    expect(payload.teacher_remark).toBe("Good work");
    expect(Object.keys(payload).sort()).toEqual([...PUBLIC_REPORT_KEYS].sort());
    const blob = JSON.stringify(payload);
    expect(blob).not.toContain("Other Student");
    expect(blob).not.toContain("Cross Tenant");
    expect(blob).not.toContain("9111111111");
    expect(blob).not.toContain("9222222222");
    for (const key of PUBLIC_SHARE_FORBIDDEN_KEYS) {
      expect(blob).not.toContain(`"${key}"`);
    }

    await asUser(OWNER_A);
    await db.query(`SELECT public.revoke_report_share($1, '2026-10-01')`, [
      STUDENT_A,
    ]);
    await asUser(null, "anon");
    expect(await report(token)).toEqual({ ok: false, reason: "revoked" });
    expect(await report(STUDENT_A)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("issues receipts with a 180-day expiry and treats expired as not_found", async () => {
    const row = await db.query<{
      share_token: string;
      expires_at: string;
    }>(
      `SELECT share_token, expires_at FROM public.receipt_shares WHERE payment_id = $1`,
      [PAYMENT_A],
    );
    const token = row.rows[0].share_token;
    const ttlDays =
      (new Date(row.rows[0].expires_at).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24);
    expect(ttlDays).toBeGreaterThan(179);
    expect(ttlDays).toBeLessThan(181);

    await db.query(
      `UPDATE public.receipt_shares SET expires_at = clock_timestamp() - interval '1 hour' WHERE payment_id = $1`,
      [PAYMENT_A],
    );
    await asUser(null, "anon");
    expect(await receipt(token)).toEqual({ ok: false, reason: "not_found" });

    const log = await db.query<{ result: string; token_hash: string }>(
      `SELECT result, token_hash FROM public.public_share_access_log
       WHERE share_kind = 'receipt' ORDER BY id DESC LIMIT 1`,
    );
    expect(log.rows[0].result).toBe("expired");
    expect(log.rows[0].token_hash).not.toBe(token);
    expect(log.rows[0].token_hash.length).toBeGreaterThanOrEqual(32);

    await asUser(OWNER_A);
    await db.query(
      `UPDATE public.receipt_shares SET expires_at = clock_timestamp() + interval '180 days' WHERE payment_id = $1`,
      [PAYMENT_A],
    );
  });

  it("lets revoke work before expiry and regenerate reset the clock", async () => {
    await asUser(OWNER_A);
    await db.query(
      `UPDATE public.receipt_shares
       SET revoked_at = NULL, expires_at = clock_timestamp() + interval '2 days'
       WHERE payment_id = $1`,
      [PAYMENT_A],
    );
    const before = (
      await db.query<{ share_token: string }>(
        `SELECT share_token FROM public.receipt_shares WHERE payment_id = $1`,
        [PAYMENT_A],
      )
    ).rows[0].share_token;

    await db.query(`SELECT public.revoke_receipt_share($1)`, [PAYMENT_A]);
    await asUser(null, "anon");
    expect(await receipt(before)).toEqual({ ok: false, reason: "revoked" });

    await asUser(OWNER_A);
    const regen = await db.query<{ j: Record<string, unknown> }>(
      `SELECT public.regenerate_receipt_share($1) AS j`,
      [PAYMENT_A],
    );
    const next = String(regen.rows[0].j.token);
    expect(next).not.toBe(before);

    const ttl = await db.query<{ days: number }>(
      `SELECT EXTRACT(EPOCH FROM (expires_at - clock_timestamp())) / 86400 AS days
       FROM public.receipt_shares WHERE payment_id = $1`,
      [PAYMENT_A],
    );
    expect(Number(ttl.rows[0].days)).toBeGreaterThan(179);
    expect(Number(ttl.rows[0].days)).toBeLessThan(181);

    await asUser(null, "anon");
    expect((await receipt(before)).ok).toBe(false);
    expect((await receipt(next)).ok).toBe(true);
  });

  it("rate-limits a hammered IP and returns generic unavailable", async () => {
    const token = (
      await db.query<{ share_token: string }>(
        `SELECT share_token FROM public.receipt_shares WHERE payment_id = $1`,
        [PAYMENT_A],
      )
    ).rows[0].share_token;
    const ip = "198.51.100.21";
    await asUser(null, "anon");
    let last: Record<string, unknown> = {};
    for (let i = 0; i < 21; i += 1) {
      last = await receipt(token, ip);
    }
    expect(last).toEqual({ ok: false, reason: "unavailable" });
    expect(JSON.stringify(last)).not.toContain("rate_limited");
    expect(JSON.stringify(last)).not.toContain("expired");

    const limited = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.public_share_access_log
       WHERE result = 'rate_limited' AND share_kind = 'receipt'`,
    );
    expect(Number(limited.rows[0].n)).toBeGreaterThanOrEqual(1);
  });

  it("writes an access log on hit and returns workspace aggregates", async () => {
    const token = (
      await db.query<{ share_token: string }>(
        `SELECT share_token FROM public.receipt_shares WHERE payment_id = $1`,
        [PAYMENT_A],
      )
    ).rows[0].share_token;
    await asUser(null, "anon");
    const payload = await receipt(token, "198.51.100.88");
    expect(payload.ok).toBe(true);

    const raw = await db.query<{
      token_hash: string;
      ip_hash: string;
      ua_hash: string;
      result: string;
    }>(
      `SELECT token_hash, ip_hash, ua_hash, result
       FROM public.public_share_access_log
       WHERE share_kind = 'receipt' AND result = 'ok'
       ORDER BY id DESC LIMIT 1`,
    );
    expect(raw.rows[0].result).toBe("ok");
    expect(raw.rows[0].token_hash).not.toBe(token);
    expect(raw.rows[0].ip_hash).not.toBe("198.51.100.88");
    expect(raw.rows[0].ua_hash).not.toBe("VidyaOrbit-PGlite/1.0");

    await asUser(OWNER_A);
    const summary = await db.query<{ j: Record<string, unknown> }>(
      `SELECT public.public_share_access_summary($1, 30) AS j`,
      [OWNER_A],
    );
    const blob = JSON.stringify(summary.rows[0].j);
    expect(summary.rows[0].j.ok).toBe(true);
    expect(blob).not.toContain(token);
    expect(blob).not.toContain("token_hash");
    expect(blob).not.toContain("198.51.100.88");

    await asUser(OWNER_B);
    await expect(
      db.query(`SELECT public.public_share_access_summary($1, 30)`, [OWNER_A]),
    ).rejects.toThrow(/Forbidden/i);
  });
});
