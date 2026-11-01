/**
 * Pure helpers for the StatCard count-up animation.
 *
 * The animation renders interim values (e.g. "₹1,52,413" on the way to
 * "₹1,57,000"). If requestAnimationFrame is throttled (background tab,
 * screenshot/recording, slow device) the card could be left showing an
 * interim number. Callers must always be able to land on the exact target.
 */
export type CountUpTarget = {
  prefix: string;
  suffix: string;
  end: number;
  decimals: number | null; // null = integer
};

export function parseCountUpTarget(target: string): CountUpTarget | null {
  const match = target.match(/-?[\d,]+(?:\.\d+)?/);
  if (!match || match.index === undefined) return null;
  const raw = match[0].replace(/,/g, "");
  const end = Number(raw);
  if (!Number.isFinite(end)) return null;
  return {
    prefix: target.slice(0, match.index),
    suffix: target.slice(match.index + match[0].length),
    end,
    decimals: raw.includes(".") ? (raw.split(".")[1]?.length ?? 1) : null,
  };
}

/** Display string at progress t in [0, 1]. At t >= 1 returns `target` verbatim. */
export function countUpFrame(target: string, t: number): string {
  if (t >= 1) return target;
  const parsed = parseCountUpTarget(target);
  if (!parsed) return target;
  const eased = 1 - Math.pow(1 - Math.max(0, t), 3);
  const cur = parsed.end * eased;
  const formatted =
    parsed.decimals === null
      ? Math.round(cur).toLocaleString("en-IN")
      : cur.toFixed(parsed.decimals);
  return `${parsed.prefix}${formatted}${parsed.suffix}`;
}
