import { addCalendarDaysISO, todayISO } from "@/lib/format";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export type DashboardAttendanceRow = {
  status: string;
  created_at: string;
  attendance_sessions: { session_date: string } | null;
};

export function dashboardAttendanceSinceISO(now: Date = new Date()): string {
  return addCalendarDaysISO(todayISO(now), -30);
}

export function fetchDashboardAttendanceRows(
  buildQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: DashboardAttendanceRow[] | null;
    error: unknown;
  }>,
): Promise<DashboardAttendanceRow[]> {
  return fetchAllRows(buildQuery);
}
