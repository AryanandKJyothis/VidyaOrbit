import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { activateOrderOnce } from "@/lib/billing-activation";

describe("activateOrderOnce", () => {
  it("calls activate_billing_order with uuid, payment id, numeric amount, currency", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        activated: true,
        owner_id: "owner-1",
        tier: "growth",
        cycle: "monthly",
      },
      error: null,
    });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const result = await activateOrderOnce(
      client,
      "11111111-1111-4111-8111-111111111111",
      "pay_abc",
      99900,
      "INR",
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("activate_billing_order", {
      _order_id: "11111111-1111-4111-8111-111111111111",
      _payment_id: "pay_abc",
      _amount: 99900,
      _currency: "INR",
    });
    expect(result).toMatchObject({ success: true, ownerId: "owner-1" });
  });

  it("returns already_activated without throwing", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { activated: false, reason: "already_activated" },
      error: null,
    });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const result = await activateOrderOnce(
      client,
      "11111111-1111-4111-8111-111111111111",
      "pay_abc",
      99900,
      "INR",
    );
    expect(result).toEqual({
      success: false,
      reason: "already_activated",
    });
  });

  it("surfaces RPC errors", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const result = await activateOrderOnce(
      client,
      "11111111-1111-4111-8111-111111111111",
      "pay_abc",
      99900,
      "INR",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("rpc_error");
  });

  it("surfaces tier_change_needs_review without treating it as a hard RPC error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        activated: false,
        reason: "tier_change_needs_review",
        needs_review: true,
        owner_id: "owner-1",
        tier: "large",
        cycle: "monthly",
      },
      error: null,
    });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const result = await activateOrderOnce(
      client,
      "11111111-1111-4111-8111-111111111111",
      "pay_abc",
      249900,
      "INR",
    );
    expect(result).toMatchObject({
      success: false,
      reason: "tier_change_needs_review",
      needsReview: true,
    });
  });
});
