import { afterEach, describe, expect, it, vi } from "vitest";
import { todayISO } from "../../../src/lib/format";

/**
 * Reproduces the IST calendar-date bugs found in Phase 1.
 * `todayISO()` is host-TZ dependent. The payment-dialog and attendance
 * Yesterday helpers use `toISOString()` and are wrong for Kerala before 05:30.
 */
describe("IST date helpers (Phase 1 probe)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("todayISO() is host-TZ dependent at 01:00 Asia/Kolkata", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T01:00:00+05:30"));
    const hostTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const result = todayISO();
    if (hostTz === "Asia/Kolkata" || hostTz === "Asia/Calcutta") {
      expect(result).toBe("2026-10-11");
    } else if (hostTz === "UTC" || hostTz === "Etc/UTC") {
      expect(result).toBe("2026-10-12");
    } else {
      expect(["2026-10-11", "2026-10-12"]).toContain(result);
    }
  });

  it("payment-dialog UTC slice is the previous day at 01:00 IST", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T01:00:00+05:30"));
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-10-11");
  });

  it("attendance Yesterday (setDate -1 then toISOString) is two days back at 01:00 IST", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T01:00:00+05:30"));
    const y = new Date();
    y.setDate(y.getDate() - 1);
    expect(y.toISOString().slice(0, 10)).toBe("2026-10-10");
  });

  it("fee overdue treats a due date of today as overdue after 05:30 IST", () => {
    const due = new Date("2026-10-12");
    expect(due < new Date("2026-10-12T02:00:00+05:30")).toBe(false);
    expect(due < new Date("2026-10-12T10:00:00+05:30")).toBe(true);
  });
});
