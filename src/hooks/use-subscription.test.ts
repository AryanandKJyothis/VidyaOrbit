import { describe, expect, it, vi } from "vitest";
import {
  fetchSubscriptionForOwner,
  PLAN_LIMITS,
} from "@/hooks/use-subscription";
import {
  formatLimit,
  remainingStudentSlots,
  UNLIMITED_STUDENT_SENTINEL,
} from "@/lib/plan-limits";

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
    expect(result.setup_fee_paid).toBe(false);
    expect(result.isOwner).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("uses subscription_health.setup_fee_paid as-is (no non-free/expiry waiver)", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        plan: "growth",
        raw_plan: "growth",
        status: "active",
        expiry_date: "2026-12-01",
        setup_fee_paid: true,
        limit: 500,
        student_count: 1,
        over_limit: false,
        over_by: 0,
        expired: false,
      },
      error: null,
    });
    const result = await fetchSubscriptionForOwner(
      { rpc, from: vi.fn() },
      OWNER,
      true,
    );
    expect(result.setup_fee_paid).toBe(true);
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
    expect(result.setup_fee_paid).toBe(false);
    expect(result.isOwner).toBe(false);
  });

  it("maps Large/pro to Infinity and any limit >= 2147483647 to Infinity", async () => {
    expect(PLAN_LIMITS.pro).toBe(Infinity);
    expect(PLAN_LIMITS.pro).not.toBe(1000);
    expect(PLAN_LIMITS.pro).not.toBe(UNLIMITED_STUDENT_SENTINEL);

    const rpc = vi.fn().mockResolvedValue({
      data: {
        plan: "pro",
        raw_plan: "pro",
        status: "active",
        start_date: "2026-01-01",
        expiry_date: "2026-12-01",
        current_period_end: null,
        plan_price: 2499,
        notes: null,
        limit: UNLIMITED_STUDENT_SENTINEL,
        student_count: 1000,
        over_limit: false,
        over_by: 0,
        days_until_expiry: 40,
        expired: false,
        setup_fee_paid: false,
      },
      error: null,
    });
    const result = await fetchSubscriptionForOwner(
      { rpc, from: vi.fn() },
      OWNER,
      true,
    );
    expect(result.limit).toBe(Infinity);
    expect(result.student_count).toBe(1000);

    rpc.mockResolvedValueOnce({
      data: {
        plan: "pro",
        raw_plan: "pro",
        status: "active",
        limit: UNLIMITED_STUDENT_SENTINEL + 1,
        student_count: 12,
        over_limit: false,
        over_by: 0,
        expired: false,
      },
      error: null,
    });
    const above = await fetchSubscriptionForOwner(
      { rpc, from: vi.fn() },
      OWNER,
      true,
    );
    expect(above.limit).toBe(Infinity);
  });

  it("never renders N / 2,14,74,83,647 for Large usage", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        plan: "pro",
        raw_plan: "pro",
        status: "active",
        limit: UNLIMITED_STUDENT_SENTINEL,
        student_count: 87,
        over_limit: false,
        over_by: 0,
        expired: false,
      },
      error: null,
    });
    const result = await fetchSubscriptionForOwner(
      { rpc, from: vi.fn() },
      OWNER,
      true,
    );
    const label = `${result.student_count} / ${formatLimit(result.limit)}`;
    expect(label).toBe("87 / Unlimited");
    expect(label).not.toMatch(/2,?14,?74,?83,?647/);
    expect(label).not.toContain(String(UNLIMITED_STUDENT_SENTINEL));
    expect(UNLIMITED_STUDENT_SENTINEL.toLocaleString("en-IN")).toBe(
      "2,14,74,83,647",
    );
  });

  it("does not stop Large imports at 1,000 students", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        plan: "pro",
        raw_plan: "pro",
        status: "active",
        limit: UNLIMITED_STUDENT_SENTINEL,
        student_count: 1000,
        over_limit: false,
        over_by: 0,
        expired: false,
      },
      error: null,
    });
    const result = await fetchSubscriptionForOwner(
      { rpc, from: vi.fn() },
      OWNER,
      true,
    );
    const remaining = remainingStudentSlots(result.limit, result.student_count);
    expect(remaining).toBe(Infinity);
    expect(remaining).toBeGreaterThan(1000);
    const wouldInsert = Array.from({ length: 1500 }, (_, i) => i).slice(
      0,
      remaining,
    );
    expect(wouldInsert).toHaveLength(1500);
  });
});
