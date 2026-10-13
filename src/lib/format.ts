export const formatINR = (n: number | null | undefined) => {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(isFinite(v) ? v : 0);
};

export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
};

export const formatDateTime = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date);
};

export const IST_TIME_ZONE = "Asia/Kolkata";

function calendarDateParts(date: Date, timeZone = IST_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** YYYY-MM-DD for `date` in the given zone. Never uses `toISOString()`. */
export function calendarDateISO(
  date: Date = new Date(),
  timeZone = IST_TIME_ZONE,
): string {
  const { year, month, day } = calendarDateParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

export const todayISO = (now: Date = new Date()) => calendarDateISO(now);

export function addCalendarDaysISO(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utcNoon = Date.UTC(year, month - 1, day + days, 12, 0, 0);
  return calendarDateISO(new Date(utcNoon));
}

export function yesterdayISO(now: Date = new Date()): string {
  return addCalendarDaysISO(todayISO(now), -1);
}

/** First IST calendar day of the month containing `now`. */
export function istMonthStartISO(now: Date = new Date()): string {
  return `${todayISO(now).slice(0, 7)}-01`;
}

export function istPrevMonthRangeISO(now: Date = new Date()): {
  start: string;
  end: string;
} {
  const end = addCalendarDaysISO(istMonthStartISO(now), -1);
  return { start: `${end.slice(0, 7)}-01`, end };
}

/** `sun`…`sat` in IST (not the host timezone). */
export function istWeekdayKey(now: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIME_ZONE,
    weekday: "short",
  })
    .format(now)
    .toLowerCase()
    .slice(0, 3);
  return weekday;
}

export function istWeekdayLong(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    weekday: "long",
  }).format(now);
}

/** Date-only compare. A due date of today (IST) is not overdue. */
export function isPastIstDate(
  iso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) < todayISO(now);
}

/** Two-letter initials from a person's name, for avatars. */
export function personInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1][0] ?? "";
  return (first + last).toUpperCase();
}
