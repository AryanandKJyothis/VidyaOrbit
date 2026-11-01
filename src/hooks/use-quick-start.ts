import { useCallback, useSyncExternalStore } from "react";
import type { Answer, FirstGoal, QuickStep } from "@/lib/onboarding-v2";

export type QuickStartState = {
  step: QuickStep;
  students: Answer | null;
  staff: Answer | null;
  chips: string[];
  custom: string[];
  goal: FirstGoal | null;
  completed: boolean;
  dismissed: boolean;
};

export const EMPTY_QUICK_START: QuickStartState = {
  step: "students",
  students: null,
  staff: null,
  chips: [],
  custom: [],
  goal: null,
  completed: false,
  dismissed: false,
};

export function quickStartKey(userId: string) {
  return `vidya:onboarding-v2:${userId}`;
}

function isAnswer(v: unknown): v is Answer {
  return !!v && typeof v === "object" && "other" in v;
}

export function parseQuickStart(raw: unknown): QuickStartState {
  if (!raw || typeof raw !== "object") return EMPTY_QUICK_START;
  const p = raw as Partial<QuickStartState>;
  return {
    step: typeof p.step === "string" && p.step !== "name" ? p.step : "students",
    students: isAnswer(p.students) ? p.students : null,
    staff: isAnswer(p.staff) ? p.staff : null,
    chips: Array.isArray(p.chips)
      ? p.chips.filter((c) => typeof c === "string")
      : [],
    custom: Array.isArray(p.custom)
      ? p.custom.filter((c) => typeof c === "string")
      : [],
    goal:
      p.goal === "attendance" || p.goal === "fees" || p.goal === "parents"
        ? p.goal
        : null,
    completed: !!p.completed,
    dismissed: !!p.dismissed,
  };
}

const caches = new Map<string, QuickStartState>();
const listeners = new Set<() => void>();

function read(userId: string): QuickStartState {
  const hit = caches.get(userId);
  if (hit) return hit;
  let next = EMPTY_QUICK_START;
  try {
    const raw = localStorage.getItem(quickStartKey(userId));
    if (raw) next = parseQuickStart(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  caches.set(userId, next);
  return next;
}

export function useQuickStart(userId: string | null) {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => (userId ? read(userId) : EMPTY_QUICK_START),
    () => EMPTY_QUICK_START,
  );
  const patch = useCallback(
    (partial: Partial<QuickStartState>) => {
      if (!userId) return;
      const next = { ...read(userId), ...partial };
      caches.set(userId, next);
      try {
        localStorage.setItem(quickStartKey(userId), JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      for (const cb of listeners) cb();
    },
    [userId],
  );
  return { state, patch };
}
