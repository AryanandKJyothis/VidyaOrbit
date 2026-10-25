import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PATH = "supabase/migrations/20261025110000_fee_overdue_whatsapp.sql";
const sql = readFileSync(PATH, "utf8");

describe("fee-overdue WhatsApp migration lock", () => {
  it("tells operators not to apply it from the agent or to prod", () => {
    expect(sql).toMatch(/DO NOT apply/i);
    expect(sql).toMatch(/Do not apply to prod/i);
  });

  it("reuses message_outbox and adds a configurable 3-day window", () => {
    expect(sql).toContain("fee_overdue_dedupe_days integer NOT NULL DEFAULT 3");
    expect(sql).toContain("fee_overdue:<student_id>:<YYYY-MM-DD>");
    expect(sql).toContain("message_outbox_fee_overdue_student_idx");
    expect(sql).not.toContain("CREATE TABLE");
    expect(sql).not.toMatch(/cron/i);
    expect(sql).not.toMatch(/wa_auto boolean NOT NULL DEFAULT true/);
  });

  it("does not grant client writes on the outbox", () => {
    expect(sql).not.toMatch(
      /GRANT\s+(INSERT|UPDATE|DELETE|ALL).+message_outbox.+TO\s+authenticated/i,
    );
    expect(sql).toContain(
      "GRANT SELECT ON TABLE public.message_outbox TO authenticated",
    );
  });
});
