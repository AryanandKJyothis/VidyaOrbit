import { describe, expect, it } from "vitest";
import { allowRequest, clientAddress } from "../../../src/lib/rate-limit";

describe("in-process rate limiter (Phase 1 probe)", () => {
  it("enforces the limit inside one process", () => {
    const key = `probe-${Date.now()}-${Math.random()}`;
    expect(allowRequest(key, 3, 60_000)).toBe(true);
    expect(allowRequest(key, 3, 60_000)).toBe(true);
    expect(allowRequest(key, 3, 60_000)).toBe(true);
    expect(allowRequest(key, 3, 60_000)).toBe(false);
  });

  it("does not share counters across keys (simulates two isolates)", () => {
    const a = `probe-a-${Date.now()}-${Math.random()}`;
    const b = `probe-b-${Date.now()}-${Math.random()}`;
    expect(allowRequest(a, 1, 60_000)).toBe(true);
    expect(allowRequest(a, 1, 60_000)).toBe(false);
    expect(allowRequest(b, 1, 60_000)).toBe(true);
  });

  it("falls back to unknown when platform IP headers are missing", () => {
    const req = new Request(
      "https://www.vidyaorbit.in/api/billing/create-order",
    );
    expect(clientAddress(req)).toBe("unknown");
  });

  it("prefers x-vercel-forwarded-for and ignores x-forwarded-for", () => {
    const req = new Request(
      "https://www.vidyaorbit.in/api/billing/create-order",
      {
        headers: {
          "x-forwarded-for": "1.2.3.4",
          "x-vercel-forwarded-for": "9.9.9.9",
        },
      },
    );
    expect(clientAddress(req)).toBe("9.9.9.9");
  });
});
