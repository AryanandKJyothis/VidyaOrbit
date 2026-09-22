import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "vidya:onboarding:v1";

export type OnboardingState = {
  dismissedChecklist: boolean;
  checklistDismissedAt?: string;
};

const defaultState: OnboardingState = {
  dismissedChecklist: false,
};

function read(): OnboardingState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const p = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      dismissedChecklist: !!p.dismissedChecklist,
      checklistDismissedAt: p.checklistDismissedAt,
    };
  } catch {
    return defaultState;
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

function persist(next: OnboardingState) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  emit();
}

export function useOnboarding() {
  const state = useSyncExternalStore(
    subscribe,
    () => cache,
    () => defaultState,
  );

  const dismissChecklist = useCallback(() => {
    persist({
      ...cache,
      dismissedChecklist: true,
      checklistDismissedAt: new Date().toISOString(),
    });
  }, []);

  const resetChecklist = useCallback(() => {
    persist({ ...cache, dismissedChecklist: false, checklistDismissedAt: undefined });
  }, []);

  return useMemo(
    () => ({
      dismissedChecklist: state.dismissedChecklist,
      dismissChecklist,
      resetChecklist,
    }),
    [state.dismissedChecklist, dismissChecklist, resetChecklist],
  );
}
