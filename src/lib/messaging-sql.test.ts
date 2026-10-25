import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAFF_PERMISSIONS_JSON } from "./workspace-roles";

const PATH = "supabase/migrations/20261025080000_parent_absence_whatsapp.sql";
const sql = readFileSync(PATH, "utf8");

describe("parent absence WhatsApp migration lock", () => {
  it("tells operators not to apply it from the agent or to prod", () => {
    expect(sql).toMatch(/DO NOT apply/i);
    expect(sql).toMatch(/Do not apply to prod/i);
  });

  it("creates the shared message_outbox with A1–A3 kinds and queued|sent|failed|skipped", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.message_outbox");
    expect(sql).toContain("UNIQUE (owner_id, dedupe_key)");
    expect(sql).toContain("'absence', 'fee_overdue', 'fee_paid'");
    expect(sql).toContain("'queued', 'sent', 'failed', 'skipped'");
    expect(sql).toContain("absence:' || NEW.session_id::text || ':' || NEW.student_id::text");
  });

  it("keeps wa_auto off by default and does not grant client writes on the outbox", () => {
    expect(sql).toContain("wa_auto boolean NOT NULL DEFAULT false");
    expect(sql).toContain(
      "GRANT SELECT ON TABLE public.message_outbox TO authenticated",
    );
    expect(sql).not.toMatch(
      /GRANT\s+(INSERT|UPDATE|DELETE|ALL).+message_outbox.+TO\s+authenticated/i,
    );
    expect(sql).not.toMatch(/GRANT\s+(SELECT|ALL).+message_outbox.+TO\s+anon/i);
  });

  it("enqueues on Absent and skips a queued row when the mark leaves Absent", () => {
    expect(sql).toContain("NEW.status IS DISTINCT FROM 'absent'");
    expect(sql).toContain("skip_reason = 'not_absent'");
    expect(sql).toContain("AND status = 'queued'");
    expect(sql).toContain("ON CONFLICT (owner_id, dedupe_key) DO NOTHING");
    expect(sql).toContain("trg_absence_parent_message");
  });

  it("backfills messages write for staff and manager so existing members lose no access", () => {
    expect(sql).toContain('{"messages":"write"}');
    expect(sql).toContain('{"messages":"none"}');
    expect(STAFF_PERMISSIONS_JSON).toContain('"messages":"write"');
  });
});
