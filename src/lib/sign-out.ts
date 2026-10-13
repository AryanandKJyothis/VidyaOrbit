export const SIGN_OUT_SELECTOR = "[data-sign-out]";

/** True when a click landed on the account-menu or setup-modal Sign out control. */
export function isSignOutTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const node = target as { closest?: (selector: string) => unknown };
  if (typeof node.closest !== "function") return false;
  return Boolean(node.closest(SIGN_OUT_SELECTOR));
}

export async function signOutAndClearCache(input: {
  signOut: () => Promise<{ error: unknown }>;
  clearCache: () => void;
}): Promise<{ ok: boolean }> {
  const { error } = await input.signOut();
  if (error) return { ok: false };
  input.clearCache();
  return { ok: true };
}
