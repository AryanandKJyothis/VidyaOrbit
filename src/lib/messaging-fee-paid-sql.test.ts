import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PATH = "supabase/migrations/20261025090000_fee_paid_whatsapp.sql";
const sql = readFileSync(PATH, "utf8");

describe("fee-paid WhatsApp migration lock", () => {
  it("tells operators not to apply it from the agent or to prod", () => {
    expect(sql).toMatch(/DO NOT apply/i);
    expect(sql).toMatch(/Do not apply to prod/i);
  });

  it("reuses message_outbox and dedupes on payment_id", () => {
    expect(sql).toContain("fee_paid:' || NEW.id::text");
    expect(sql).toContain("ON CONFLICT (owner_id, dedupe_key) DO NOTHING");
    expect(sql).toContain("trg_fee_paid_parent_message");
    expect(sql).toContain("AFTER INSERT ON public.fee_payments");
    expect(sql).not.toContain("CREATE TABLE");
  });

  it("embeds a public unguessable receipt link on vidyaorbit.in", () => {
    expect(sql).toContain("https://www.vidyaorbit.in/r/");
    expect(sql).toContain("generate_share_token");
    expect(sql).toContain("receipt_shares");
    expect(sql).toContain("Payment received:");
    expect(sql).toContain("trg_fee_paid_ack_on_share_change");
  });

  it("does not grant client writes on the outbox", () => {
    expect(sql).not.toMatch(
      /GRANT\s+(INSERT|UPDATE|DELETE|ALL).+message_outbox.+TO\s+authenticated/i,
    );
    expect(sql).toContain("fees', false");
  });
});
