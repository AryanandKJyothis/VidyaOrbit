import { describe, expect, it, vi } from "vitest";
import { fetchSubscriptionForOwner } from "@/hooks/use-subscription";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("fetchSubscriptionForOwner", () => {
  it("lets a workspace member see the owner's plan via subscription_health", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        plan: "growth",
        raw_plan: "growth",
        status: "active",
        start_date: "2026-01-01",
        expiry_date: "2026-12-01",
        current_period_end: null,
        plan_price: 999,
        notes: null,
        limit: 500,
        student_count: 12,
        over_limit: false,
        over_by: 0,
        days_until_expiry: 40,
        expired: false,
      },
      error: null,
    });
    const supabase = {
      rpc,
      from: vi.fn(),
    };
    const result = await fetchSubscriptionForOwner(supabase, OWNER, false);
    expect(rpc).toHaveBeenCalledWith("subscription_health", { _uid: OWNER });
    expect(result.plan).toBe("growth");
    expect(result.isOwner).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("does not select setup_fee_paid in the fallback read", async () => {
    let selected: string | null = null;
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Forbidden", code: "42501" },
      }),
      from: vi.fn(() => ({
        select: (cols: string) => {
          selected = cols;
          return {
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  plan: "growth",
                  status: "active",
                  current_period_end: null,
                  start_date: "2026-01-01",
                  expiry_date: "2026-12-01",
                  plan_price: 999,
                  notes: null,
                },
                error: null,
              }),
            }),
          };
        },
      })),
    };
    const result = await fetchSubscriptionForOwner(supabase, OWNER, false);
    expect(selected).toBeTruthy();
    expect(selected).not.toMatch(/setup_fee_paid/);
    expect(result.plan).toBe("growth");
    expect(result.isOwner).toBe(false);
  });
});
