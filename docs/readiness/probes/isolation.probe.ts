import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Local PGlite replica of the repo RLS helpers + tenant policies.
 * Does not connect to live Supabase. Proves the policy model blocks
 * cross-institute reads/writes when auth.uid() is the caller.
 */
const OWNER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STAFF_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STRANGER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const BATCH_A = "11111111-1111-4111-8111-111111111111";
const BATCH_B = "22222222-2222-4222-8222-222222222222";
const STUDENT_A = "33333333-3333-4333-8333-333333333333";
const STUDENT_B = "44444444-4444-4444-8444-444444444444";

const SCHEMA = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.uid', true), '')::uuid;
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.role', true), ''), 'authenticated');
$$;

CREATE TABLE public.workspace_members (
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (owner_id, user_id)
);

CREATE TABLE public.batches (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL
);
CREATE TABLE public.students (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  full_name text NOT NULL,
  batch_id uuid,
  fee_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
);
CREATE TABLE public.fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  student_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_date date NOT NULL
);
CREATE TABLE public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  session_date date NOT NULL,
  UNIQUE (batch_id, session_date)
);
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  status text NOT NULL,
  UNIQUE (session_id, student_id)
);

CREATE OR REPLACE FUNCTION public.has_resource_access(
  _owner uuid, _uid uuid, _resource text, _write boolean
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_permission text;
BEGIN
  IF auth.role() <> 'service_role' AND _uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF _owner = _uid THEN RETURN true; END IF;
  SELECT permissions->>_resource INTO v_permission
    FROM public.workspace_members
    WHERE owner_id = _owner AND user_id = _uid;
  IF _write THEN RETURN COALESCE(v_permission, 'none') = 'write'; END IF;
  RETURN COALESCE(v_permission, 'none') IN ('read', 'write');
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_workspace_references()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE referenced_owner uuid;
BEGIN
  -- Nested IF so PGlite does not evaluate NEW.batch_id on other tables.
  IF TG_TABLE_NAME = 'students' THEN
    IF NEW.batch_id IS NOT NULL THEN
      SELECT owner_id INTO referenced_owner FROM public.batches WHERE id = NEW.batch_id;
      IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
        RAISE EXCEPTION 'Student and batch must belong to the same workspace' USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'fee_payments' THEN
    SELECT owner_id INTO referenced_owner FROM public.students WHERE id = NEW.student_id;
    IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Payment and student must belong to the same workspace' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'attendance_sessions' THEN
    SELECT owner_id INTO referenced_owner FROM public.batches WHERE id = NEW.batch_id;
    IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Attendance session and batch must belong to the same workspace' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'attendance_records' THEN
    SELECT owner_id INTO referenced_owner FROM public.attendance_sessions WHERE id = NEW.session_id;
    IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Attendance record and session must belong to the same workspace' USING ERRCODE = '23514';
    END IF;
    SELECT owner_id INTO referenced_owner FROM public.students WHERE id = NEW.student_id;
    IF referenced_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Attendance record and student must belong to the same workspace' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER students_validate_workspace_refs
  BEFORE INSERT OR UPDATE OF owner_id, batch_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_references();
CREATE TRIGGER payments_validate_workspace_refs
  BEFORE INSERT OR UPDATE OF owner_id, student_id ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_references();
CREATE TRIGGER attendance_sessions_validate_workspace_refs
  BEFORE INSERT OR UPDATE OF owner_id, batch_id ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_references();
CREATE TRIGGER attendance_records_validate_workspace_refs
  BEFORE INSERT OR UPDATE OF owner_id, session_id, student_id ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_references();

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY batches_select ON public.batches FOR SELECT USING (has_resource_access(owner_id, auth.uid(), 'batches', false));
CREATE POLICY batches_insert ON public.batches FOR INSERT WITH CHECK (has_resource_access(owner_id, auth.uid(), 'batches', true));
CREATE POLICY batches_update ON public.batches FOR UPDATE USING (has_resource_access(owner_id, auth.uid(), 'batches', true)) WITH CHECK (has_resource_access(owner_id, auth.uid(), 'batches', true));
CREATE POLICY batches_delete ON public.batches FOR DELETE USING (has_resource_access(owner_id, auth.uid(), 'batches', true));

CREATE POLICY students_select ON public.students FOR SELECT USING (has_resource_access(owner_id, auth.uid(), 'students', false));
CREATE POLICY students_insert ON public.students FOR INSERT WITH CHECK (has_resource_access(owner_id, auth.uid(), 'students', true));
CREATE POLICY students_update ON public.students FOR UPDATE USING (has_resource_access(owner_id, auth.uid(), 'students', true)) WITH CHECK (has_resource_access(owner_id, auth.uid(), 'students', true));
CREATE POLICY students_delete ON public.students FOR DELETE USING (has_resource_access(owner_id, auth.uid(), 'students', true));

CREATE POLICY fp_select ON public.fee_payments FOR SELECT USING (has_resource_access(owner_id, auth.uid(), 'fees', false));
CREATE POLICY fp_insert ON public.fee_payments FOR INSERT WITH CHECK (has_resource_access(owner_id, auth.uid(), 'fees', true));

CREATE POLICY att_s_select ON public.attendance_sessions FOR SELECT USING (has_resource_access(owner_id, auth.uid(), 'attendance', false));
CREATE POLICY att_s_insert ON public.attendance_sessions FOR INSERT WITH CHECK (has_resource_access(owner_id, auth.uid(), 'attendance', true));
CREATE POLICY att_r_select ON public.attendance_records FOR SELECT USING (has_resource_access(owner_id, auth.uid(), 'attendance', false));
CREATE POLICY att_r_insert ON public.attendance_records FOR INSERT WITH CHECK (has_resource_access(owner_id, auth.uid(), 'attendance', true));

CREATE VIEW public.students_gated
WITH (security_invoker=false, security_barrier=true) AS
SELECT s.id, s.owner_id, s.full_name, s.batch_id, s.status,
  CASE WHEN public.has_resource_access(s.owner_id, auth.uid(), 'fees', false)
    THEN s.fee_total END AS fee_total
FROM public.students s
WHERE public.has_resource_access(s.owner_id, auth.uid(), 'students', false);

DO $$ BEGIN CREATE ROLE rls_user; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public TO rls_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rls_user;
GRANT SELECT ON public.students_gated TO rls_user;
GRANT EXECUTE ON FUNCTION public.has_resource_access(uuid, uuid, text, boolean) TO rls_user;
`;

let db: PGlite;

async function asUser(uid: string | null, fn: () => Promise<void>) {
  await db.exec("RESET ROLE");
  if (uid) {
    await db.exec(`SELECT set_config('app.uid', '${uid}', false);`);
    await db.exec(`SELECT set_config('app.role', 'authenticated', false);`);
  } else {
    await db.exec(`SELECT set_config('app.uid', '', false);`);
    await db.exec(`SELECT set_config('app.role', 'anon', false);`);
  }
  await db.exec("SET ROLE rls_user");
  try {
    await fn();
  } finally {
    await db.exec("RESET ROLE");
  }
}

async function seedAsOwner() {
  await db.exec(`SELECT set_config('app.uid', '${OWNER_A}', false);`);
  await db.exec(`SELECT set_config('app.role', 'service_role', false);`);
  await db.exec(`
    INSERT INTO public.workspace_members (owner_id, user_id, permissions) VALUES
      ('${OWNER_A}', '${STAFF_A}', '{"students":"read","batches":"read","fees":"none","attendance":"write"}');
    INSERT INTO public.batches (id, owner_id, name) VALUES
      ('${BATCH_A}', '${OWNER_A}', 'A morning'),
      ('${BATCH_B}', '${OWNER_B}', 'B evening');
    INSERT INTO public.students (id, owner_id, full_name, batch_id, fee_total) VALUES
      ('${STUDENT_A}', '${OWNER_A}', 'Anu', '${BATCH_A}', 12000),
      ('${STUDENT_B}', '${OWNER_B}', 'Binu', '${BATCH_B}', 18000);
  `);
}

describe("multi-institute isolation (Phase 1 PGlite probe)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(SCHEMA);
    await seedAsOwner();
  });

  afterAll(async () => {
    await db?.close();
  });

  it("owner A cannot select owner B students", async () => {
    await asUser(OWNER_A, async () => {
      const rows = await db.query<{ id: string }>(
        "SELECT id FROM public.students WHERE id = $1",
        [STUDENT_B],
      );
      expect(rows.rows).toEqual([]);
    });
  });

  it("owner A cannot insert a student under owner B", async () => {
    await asUser(OWNER_A, async () => {
      await expect(
        db.query(
          `INSERT INTO public.students (id, owner_id, full_name)
           VALUES (gen_random_uuid(), $1, 'leak')`,
          [OWNER_B],
        ),
      ).rejects.toThrow();
    });
  });

  it("owner A cannot update owner B student", async () => {
    await asUser(OWNER_A, async () => {
      const res = await db.query(
        "UPDATE public.students SET full_name = 'hacked' WHERE id = $1",
        [STUDENT_B],
      );
      expect(res.affectedRows ?? 0).toBe(0);
    });
  });

  it("owner A cannot pay owner B student even with A's owner_id (cross-tenant trigger)", async () => {
    await asUser(OWNER_A, async () => {
      await expect(
        db.query(
          `INSERT INTO public.fee_payments (owner_id, student_id, amount, payment_date)
           VALUES ($1, $2, 100, '2026-10-12')`,
          [OWNER_A, STUDENT_B],
        ),
      ).rejects.toThrow(/same workspace/);
    });
  });

  it("owner A cannot attach a student to owner B batch", async () => {
    await asUser(OWNER_A, async () => {
      await expect(
        db.query("UPDATE public.students SET batch_id = $1 WHERE id = $2", [
          BATCH_B,
          STUDENT_A,
        ]),
      ).rejects.toThrow(/same workspace/);
    });
  });

  it("stranger sees no students", async () => {
    await asUser(STRANGER, async () => {
      const rows = await db.query("SELECT id FROM public.students");
      expect(rows.rows).toEqual([]);
    });
  });

  it("anon with null uid sees no students", async () => {
    await asUser(null, async () => {
      const rows = await db.query("SELECT id FROM public.students");
      expect(rows.rows).toEqual([]);
    });
  });

  it("staff with students:read can read A but not B; fees stay hidden on gated view", async () => {
    await asUser(STAFF_A, async () => {
      const own = await db.query<{ id: string }>(
        "SELECT id FROM public.students WHERE owner_id = $1",
        [OWNER_A],
      );
      expect(own.rows.map((r) => r.id)).toEqual([STUDENT_A]);
      const other = await db.query(
        "SELECT id FROM public.students WHERE owner_id = $1",
        [OWNER_B],
      );
      expect(other.rows).toEqual([]);
      const gated = await db.query<{ fee_total: number | null }>(
        "SELECT fee_total FROM public.students_gated WHERE id = $1",
        [STUDENT_A],
      );
      expect(gated.rows[0]?.fee_total).toBeNull();
    });
  });

  it("staff with fees:none cannot insert a payment on A", async () => {
    await asUser(STAFF_A, async () => {
      await expect(
        db.query(
          `INSERT INTO public.fee_payments (owner_id, student_id, amount, payment_date)
           VALUES ($1, $2, 50, '2026-10-12')`,
          [OWNER_A, STUDENT_A],
        ),
      ).rejects.toThrow();
    });
  });

  it("owner A can read own student and fee total via gated view", async () => {
    await asUser(OWNER_A, async () => {
      const gated = await db.query<{ fee_total: string | number }>(
        "SELECT fee_total FROM public.students_gated WHERE id = $1",
        [STUDENT_A],
      );
      expect(Number(gated.rows[0]?.fee_total)).toBe(12000);
    });
  });

  it("attendance unique (batch_id, session_date) rejects a duplicate session", async () => {
    await asUser(OWNER_A, async () => {
      await db.query(
        `INSERT INTO public.attendance_sessions (owner_id, batch_id, session_date)
         VALUES ($1, $2, '2026-10-12')`,
        [OWNER_A, BATCH_A],
      );
      await expect(
        db.query(
          `INSERT INTO public.attendance_sessions (owner_id, batch_id, session_date)
           VALUES ($1, $2, '2026-10-12')`,
          [OWNER_A, BATCH_A],
        ),
      ).rejects.toThrow();
    });
  });
});
