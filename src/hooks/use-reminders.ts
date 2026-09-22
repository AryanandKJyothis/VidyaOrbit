import { useSyncExternalStore } from "react";

const STORAGE_KEY = "vidya:reminders:v1";

export type ReminderPrefs = {
  /** weekday 0–6 (Sun–Sat), default Tue */
  digestWeekday: number;
  enabled: boolean;
};

const defaultPrefs: ReminderPrefs = {
  digestWeekday: 2,
  enabled: true,
};

function read(): ReminderPrefs {
  if (typeof window === "undefined") return defaultPrefs;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs;
    const p = JSON.parse(raw) as Partial<ReminderPrefs>;
    const wd = typeof p.digestWeekday === "number" ? Math.min(6, Math.max(0, p.digestWeekday)) : 2;
    return {
      digestWeekday: wd,
      enabled: p.enabled !== false,
    };
  } catch {
    return defaultPrefs;
  }
}

let cache = read();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  for (const cb of listeners) cb();
}

export function getReminderPrefs(): ReminderPrefs {
  return cache;
}

export function setReminderPrefs(next: Partial<ReminderPrefs>) {
  cache = { ...cache, ...next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
  emit();
}

/** Subscribe to reminder prefs (updates when `setReminderPrefs` runs). */
export function useReminderPrefs() {
  return useSyncExternalStore(
    subscribe,
    () => cache,
    () => defaultPrefs,
  );
}
