import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  effectiveStudentLimit,
  grandfatherOverrideFor,
  UNLIMITED_STUDENT_SENTINEL,
} from "./plan-limits";

const SPARK_OVER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; // starter, 70 students
const ORBIT_UNDER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"; // growth, 10 students
const CENTRE_OVER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"; // pro, 410 students
const SPARK_EXPIRED = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"; // starter expired, 60

const STUB = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'service_role'::text $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TYPE public.plan_code AS ENUM ('free','starter','growth','pro','campus');
CREATE TABLE public.subscriptions (
  owner_id uuid PRIMARY KEY, plan public.plan_code NOT NULL DEFAULT 'free',
  status text DEFAULT 'active', start_date timestamptz, expiry_date timestamptz,
  current_period_end timestamptz, plan_price numeric, notes text,
  setup_fee_paid boolean DEFAULT false
);
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL,
  full_name text NOT NULL, status text DEFAULT 'active'
);
CREATE TABLE public.billing_orders (owner_id uuid, activated_at timestamptz, key_mode text, status text, paid_at timestamptz);
CREATE FUNCTION public.is_workspace_member(_o uuid, _u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION public.current_plan(_uid uuid) RETURNS public.plan_code LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT CASE WHEN s.expiry_date IS NOT NULL AND s.expiry_date < now() THEN 'free'::public.plan_code
                               ELSE s.plan END FROM public.subscriptions s WHERE s.owner_id = _uid), 'free'::public.plan_code)
$$;
`;

function capsFunction(): string {
  const sql = readFileSync(
    "supabase/migrations/20261101090100_pricing_2026_11_01_plan_caps.sql",
    "utf8",
  );
  const start = sql.indexOf(
    "CREATE OR REPLACE FUNCTION public.plan_student_limit",
  );
  const end = sql.indexOf("$$;", start) + 3;
  return sql.slice(start, end);
}

async function seed(
  db: PGlite,
  owner: string,
  plan: string,
  n: number,
  expired = false,
) {
  await db.exec(
    `INSERT INTO public.subscriptions (owner_id, plan, expiry_date) VALUES ('${owner}', '${plan}', ${expired ? "now() - interval '1 day'" : "NULL"});
     INSERT INTO public.students (owner_id, full_name) SELECT '${owner}', 's' || g FROM generate_series(1, ${n}) g;`,
  );
}

async function addStudent(db: PGlite, owner: string) {
  await db.exec(
    `INSERT INTO public.students (owner_id, full_name) VALUES ('${owner}', 'new')`,
  );
}

async function health(db: PGlite, owner: string) {
  const r = await db.query<{ h: { limit: number; over_limit: boolean } }>(
    `SELECT public.subscription_health('${owner}') AS h`,
  );
  return r.rows[0]!.h;
}

describe("grandfathered caps (pglite)", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(STUB);
    await db.exec(capsFunction());
    await seed(db, SPARK_OVER, "starter", 70);
    await seed(db, ORBIT_UNDER, "growth", 10);
    await seed(db, CENTRE_OVER, "pro", 410);
    await seed(db, SPARK_EXPIRED, "starter", 60, true);
    await db.exec(
      readFileSync(
        "supabase/migrations/20261101090200_pricing_2026_11_01_grandfather_caps.sql",
        "utf8",
      ),
    );
    await db.exec(`CREATE TRIGGER enforce_student_limit BEFORE INSERT ON public.students
      FOR EACH ROW EXECUTE FUNCTION public.enforce_student_limit();`);
  }, 60_000);

  it("seeds overrides only for centres over the new cap", async () => {
    const r = await db.query<{
      owner_id: string;
      student_cap_override: number | null;
      grandfathered_plan: string | null;
    }>(
      "SELECT owner_id, student_cap_override, grandfathered_plan FROM public.subscriptions ORDER BY owner_id",
    );
    const by = Object.fromEntries(r.rows.map((x) => [x.owner_id, x]));
    expect(by[SPARK_OVER]).toMatchObject({
      student_cap_override: 100,
      grandfathered_plan: "starter",
    });
    expect(by[ORBIT_UNDER]!.student_cap_override).toBeNull();
    expect(by[CENTRE_OVER]).toMatchObject({
      student_cap_override: UNLIMITED_STUDENT_SENTINEL,
      grandfathered_plan: "pro",
    });
    // Expired is still on a starter row with 60 > 50, so it is grandfathered,
    // but the override only applies while current_plan is starter (see below).
    expect(by[SPARK_EXPIRED]!.grandfathered_plan).toBe("starter");
  });

  it("over-cap Spark centre can still add students (old cap 100), not over limit", async () => {
    await addStudent(db, SPARK_OVER);
    const h = await health(db, SPARK_OVER);
    expect(h.limit).toBe(100);
    expect(h.over_limit).toBe(false);
  });

  it("over-cap Centre keeps unlimited", async () => {
    await addStudent(db, CENTRE_OVER);
    expect((await health(db, CENTRE_OVER)).limit).toBe(
      UNLIMITED_STUDENT_SENTINEL,
    );
  });

  it("non-grandfathered centre uses the new cap", async () => {
    expect((await health(db, ORBIT_UNDER)).limit).toBe(150);
  });

  it("expired centre falls back to free cap and is blocked", async () => {
    expect((await health(db, SPARK_EXPIRED)).limit).toBe(25);
    await expect(addStudent(db, SPARK_EXPIRED)).rejects.toThrow(
      /plan limit of 25/,
    );
  });

  it("grandfathered centre is blocked at its old cap", async () => {
    await db.exec(
      `INSERT INTO public.students (owner_id, full_name) SELECT '${SPARK_OVER}', 'x' || g FROM generate_series(1, 29) g`,
    );
    await expect(addStudent(db, SPARK_OVER)).rejects.toThrow(
      /Spark plan limit of 100/,
    );
  });

  it("seed is idempotent", async () => {
    await db.exec(
      readFileSync(
        "supabase/migrations/20261101090200_pricing_2026_11_01_grandfather_caps.sql",
        "utf8",
      ),
    );
    const r = await db.query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM public.subscriptions WHERE student_cap_override IS NOT NULL",
    );
    expect(r.rows[0]!.n).toBe(3);
  });
});

describe("effectiveStudentLimit (client mirror)", () => {
  it("override only while on the grandfathered plan; never lowers cap", () => {
    expect(
      effectiveStudentLimit({
        plan: "starter",
        override: 100,
        grandfatheredPlan: "starter",
      }),
    ).toBe(100);
    expect(
      effectiveStudentLimit({
        plan: "growth",
        override: 100,
        grandfatheredPlan: "starter",
      }),
    ).toBe(150);
    expect(
      effectiveStudentLimit({
        plan: "free",
        override: 100,
        grandfatheredPlan: "starter",
      }),
    ).toBe(25);
    expect(
      effectiveStudentLimit({
        plan: "pro",
        override: UNLIMITED_STUDENT_SENTINEL,
        grandfatheredPlan: "pro",
      }),
    ).toBeNull();
    expect(
      effectiveStudentLimit({
        plan: "starter",
        override: 10,
        grandfatheredPlan: "starter",
      }),
    ).toBe(50);
    expect(effectiveStudentLimit({ plan: "starter" })).toBe(50);
  });
  it("grandfatherOverrideFor mirrors the seed", () => {
    expect(grandfatherOverrideFor("starter", 70)).toBe(100);
    expect(grandfatherOverrideFor("starter", 50)).toBeNull();
    expect(grandfatherOverrideFor("growth", 151)).toBe(500);
    expect(grandfatherOverrideFor("pro", 401)).toBe(UNLIMITED_STUDENT_SENTINEL);
    expect(grandfatherOverrideFor("free", 30)).toBeNull();
    expect(grandfatherOverrideFor("campus", 9999)).toBeNull();
  });
});
