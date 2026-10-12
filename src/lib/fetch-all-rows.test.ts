import { describe, expect, it } from "vitest";
import {
  FETCH_ALL_ROWS_PAGE_SIZE,
  fetchAllRows,
  fetchAttendanceAnalyticsRows,
  type AttendanceAnalyticsRow,
} from "./fetch-all-rows";

function makeRows(count: number): AttendanceAnalyticsRow[] {
  return Array.from({ length: count }, (_, i) => ({
    status: "present",
    student_id: `s-${i}`,
    attendance_sessions: { batch_id: "b1", session_date: "2026-10-01" },
  }));
}

describe("fetchAllRows / analytics attendance (VO-013)", () => {
  it("a single unpaginated select silently drops rows past 1000", async () => {
    const all = makeRows(1001);
    const unpaginated = all.slice(0, FETCH_ALL_ROWS_PAGE_SIZE);
    expect(unpaginated).toHaveLength(1000);
    expect(unpaginated).not.toHaveLength(1001);
  });

  it("paginated fetch returns all 1001 attendance rows", async () => {
    const all = makeRows(1001);
    const rows = await fetchAttendanceAnalyticsRows(async (from, to) => ({
      data: all.slice(from, to + 1),
      error: null,
    }));
    expect(rows).toHaveLength(1001);
    expect(rows[1000]?.student_id).toBe("s-1000");
  });

  it("stops after a short last page and surfaces query errors", async () => {
    const all = makeRows(3);
    const rows = await fetchAllRows(async (from, to) => ({
      data: all.slice(from, to + 1),
      error: null,
    }));
    expect(rows).toHaveLength(3);

    await expect(
      fetchAllRows(async () => ({ data: null, error: new Error("boom") })),
    ).rejects.toThrow("boom");
  });
});
