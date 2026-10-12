/** PostgREST's default max-rows cap. Callers must page or they silently truncate. */
export const FETCH_ALL_ROWS_PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  buildQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += FETCH_ALL_ROWS_PAGE_SIZE) {
    const { data, error } = await buildQuery(
      from,
      from + FETCH_ALL_ROWS_PAGE_SIZE - 1,
    );
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < FETCH_ALL_ROWS_PAGE_SIZE) return rows;
  }
}

export type AttendanceAnalyticsRow = {
  status: string;
  student_id: string;
  attendance_sessions: { batch_id: string; session_date: string } | null;
};

/** Same select as the analytics page; always paged through fetchAllRows. */
export function fetchAttendanceAnalyticsRows(
  buildQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: AttendanceAnalyticsRow[] | null;
    error: unknown;
  }>,
): Promise<AttendanceAnalyticsRow[]> {
  return fetchAllRows(buildQuery);
}
