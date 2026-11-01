/**
 * Month-over-month collection comparison. Only compares when both months have
 * money in them, so we never show "-100% behind" on day 1 or divide by zero.
 */
export type MonthComparison =
  | { kind: "compare"; deltaPct: number; diff: number }
  | { kind: "no-current" }
  | { kind: "no-previous" };

export const NO_PAYMENTS_YET_LINE = "New month, no payments yet";

export function compareMonths(
  current: number,
  previous: number,
): MonthComparison {
  const cur = Number.isFinite(current) ? current : 0;
  const prev = Number.isFinite(previous) ? previous : 0;
  if (cur <= 0) return { kind: "no-current" };
  if (prev <= 0) return { kind: "no-previous" };
  return {
    kind: "compare",
    deltaPct: Math.round(((cur - prev) / prev) * 100),
    diff: cur - prev,
  };
}

/** Percent delta, or undefined when the comparison isn't meaningful. */
export function monthDeltaPct(
  current: number,
  previous: number,
): number | undefined {
  const c = compareMonths(current, previous);
  return c.kind === "compare" ? c.deltaPct : undefined;
}
