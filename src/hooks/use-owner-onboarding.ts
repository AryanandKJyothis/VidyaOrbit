import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  EMPTY_OWNER_SETUP_PERSISTED,
  ownerSetupStorageKey,
  parseOwnerSetupPersisted,
  type OwnerSetupDraft,
  type OwnerSetupPersisted,
  type WizardStepId,
} from "@/lib/owner-onboarding";

const caches = new Map<string, OwnerSetupPersisted>();
const listeners = new Map<string, Set<() => void>>();

function read(userId: string): OwnerSetupPersisted {
  if (typeof window === "undefined") return EMPTY_OWNER_SETUP_PERSISTED;
  try {
    const raw = localStorage.getItem(ownerSetupStorageKey(userId));
    if (!raw) return EMPTY_OWNER_SETUP_PERSISTED;
    return parseOwnerSetupPersisted(JSON.parse(raw));
  } catch {
    return EMPTY_OWNER_SETUP_PERSISTED;
  }
}

function cached(userId: string): OwnerSetupPersisted {
  const hit = caches.get(userId);
  if (hit) return hit;
  const next = read(userId);
  caches.set(userId, next);
  return next;
}

function emit(userId: string) {
  const set = listeners.get(userId);
  if (!set) return;
  for (const cb of set) cb();
}

function persist(userId: string, next: OwnerSetupPersisted) {
  caches.set(userId, next);
  try {
    localStorage.setItem(ownerSetupStorageKey(userId), JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  emit(userId);
}

function subscribeTo(userId: string, cb: () => void) {
  let set = listeners.get(userId);
  if (!set) {
    set = new Set();
    listeners.set(userId, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
  };
}

export function useOwnerOnboarding(userId: string | null) {
  const state = useSyncExternalStore(
    (cb) => (userId ? subscribeTo(userId, cb) : () => {}),
    () => (userId ? cached(userId) : EMPTY_OWNER_SETUP_PERSISTED),
    () => EMPTY_OWNER_SETUP_PERSISTED,
  );

  const patch = useCallback(
    (partial: Partial<OwnerSetupPersisted>) => {
      if (!userId) return;
      persist(userId, { ...cached(userId), ...partial });
    },
    [userId],
  );

  const setDraft = useCallback(
    (draft: OwnerSetupDraft) => patch({ draft }),
    [patch],
  );

  const setStep = useCallback(
    (currentStep: WizardStepId) => patch({ currentStep }),
    [patch],
  );

  const skipStep = useCallback(
    (step: WizardStepId) => {
      if (!userId) return;
      const cur = cached(userId);
      const skippedSteps = cur.skippedSteps.includes(step)
        ? cur.skippedSteps
        : [...cur.skippedSteps, step];
      persist(userId, { ...cur, skippedSteps });
    },
    [userId],
  );

  const skipSetup = useCallback(() => {
    patch({
      skipped: true,
      tourReady: true,
      skippedAt: new Date().toISOString(),
    });
  }, [patch]);

  const markStarted = useCallback(() => {
    patch({ started: true });
  }, [patch]);

  const completeSetup = useCallback(() => {
    patch({
      completed: true,
      started: true,
      skipped: false,
      tourReady: true,
      completedAt: new Date().toISOString(),
    });
  }, [patch]);

  const resumeSetup = useCallback(() => {
    patch({ skipped: false, completed: false });
  }, [patch]);

  const dismissTour = useCallback(() => {
    patch({ tourDismissed: true, tourReady: false });
  }, [patch]);

  const completeTour = useCallback(() => {
    patch({ tourCompleted: true, tourReady: false });
  }, [patch]);

  return useMemo(
    () => ({
      state,
      setDraft,
      setStep,
      skipStep,
      skipSetup,
      markStarted,
      completeSetup,
      resumeSetup,
      dismissTour,
      completeTour,
    }),
    [
      state,
      setDraft,
      setStep,
      skipStep,
      skipSetup,
      markStarted,
      completeSetup,
      resumeSetup,
      dismissTour,
      completeTour,
    ],
  );
}
