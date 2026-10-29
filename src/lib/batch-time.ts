/**
 * Parse/sort helpers for free-text `batches.timing` (e.g. "7:00 AM - 8:30 AM",
 * "4 PM", "18:00"). Pure, no I/O.
 */

const TIME_RE = /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i;

/** Minutes after midnight of the first time in `timing`, or null if none. */
export function parseStartMinutes(
  timing: string | null | undefined,
): number | null {
  if (!timing) return null;
  const m = TIME_RE.exec(timing);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const mer = m[3]?.toLowerCase().replace(/\./g, "");
  // A bare number with no minutes and no am/pm isn't a reliable time.
  if (!m[2] && !mer) return null;
  if (min > 59) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === "am") h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  } else if (h > 23) return null;
  return h * 60 + min;
}

/** Ascending by start time; unparseable last; ties by name. Non-mutating. */
export function sortBatchesByTime<
  T extends { timing?: string | null; name: string },
>(batches: readonly T[]): T[] {
  return batches
    .map((b) => ({ b, t: parseStartMinutes(b.timing) }))
    .sort((x, y) => {
      if (x.t === null && y.t !== null) return 1;
      if (y.t === null && x.t !== null) return -1;
      if (x.t !== null && y.t !== null && x.t !== y.t) return x.t - y.t;
      return x.b.name.localeCompare(y.b.name);
    })
    .map((x) => x.b);
}

/** Current minutes after midnight in IST (Asia/Kolkata). */
export function istNowMinutes(now: Date = new Date()): number {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

/**
 * Next batch by clock: first (sorted) batch starting at/after `nowMinutes`;
 * else the first batch in the list (all have started / unparseable).
 */
export function pickNextBatch<
  T extends { timing?: string | null; name: string },
>(sorted: readonly T[], nowMinutes: number): T | undefined {
  return (
    sorted.find((b) => {
      const t = parseStartMinutes(b.timing);
      return t !== null && t >= nowMinutes;
    }) ?? sorted[0]
  );
}

/** Label for pickers: "Name · timing". */
export function batchLabel(b: {
  name: string;
  timing?: string | null;
}): string {
  return b.timing ? `${b.name} · ${b.timing}` : b.name;
}
