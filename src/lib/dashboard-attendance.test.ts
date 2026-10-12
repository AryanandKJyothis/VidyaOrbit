import { describe, expect, it } from "vitest";
import { subDays } from "date-fns";
import { FETCH_ALL_ROWS_PAGE_SIZE } from "./fetch-all-rows";
import {
  dashboardAttendanceSinceISO,
  fetchDashboardAttendanceRows,
  type DashboardAttendanceRow,
} from "./dashboard-attendance";
import { istMonthStartISO, todayISO } from "./format";

const oneAmIst = new Date("2026-10-12T01:00:00+05:30");

function makeRows(count: number): DashboardAttendanceRow[] {
  return Array.from({ length: count }, (_, i) => ({
    status: "present",
    created_at: "2026-10-01T10:00:00+05:30",
    attendance_sessions: { session_date: `2026-10-0${(i % 9) + 1}` },
  }));
}

describe("dashboard leftover IST dates + VO-036", () => {
  it("UTC toISOString slice was the previous calendar day at 01:00 IST", () => {
    expect(oneAmIst.toISOString().slice(0, 10)).toBe("2026-10-11");
    expect(subDays(oneAmIst, 30).toISOString().slice(0, 10)).toBe("2026-09-11");
    expect(todayISO(oneAmIst)).toBe("2026-10-12");
    expect(dashboardAttendanceSinceISO(oneAmIst)).toBe("2026-09-12");
    expect(istMonthStartISO(oneAmIst)).toBe("2026-10-01");
  });

  it("a single unpaginated dashboard select drops rows past 1000", () => {
    const all = makeRows(1001);
    expect(all.slice(0, FETCH_ALL_ROWS_PAGE_SIZE)).toHaveLength(1000);
  });

  it("paginated dashboard fetch returns all 1001 attendance rows", async () => {
    const all = makeRows(1001);
    const rows = await fetchDashboardAttendanceRows(async (from, to) => ({
      data: all.slice(from, to + 1),
      error: null,
    }));
    expect(rows).toHaveLength(1001);
  });
});
