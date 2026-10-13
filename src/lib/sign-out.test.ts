import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { isSignOutTarget, signOutAndClearCache } from "./sign-out";

describe("signOutAndClearCache", () => {
  it("clears the cache after a successful sign-out", async () => {
    const clearCache = vi.fn();
    const result = await signOutAndClearCache({
      signOut: async () => ({ error: null }),
      clearCache,
    });
    expect(result).toEqual({ ok: true });
    expect(clearCache).toHaveBeenCalledOnce();
  });

  it("does not clear the cache when sign-out fails", async () => {
    const clearCache = vi.fn();
    const result = await signOutAndClearCache({
      signOut: async () => ({ error: { message: "network" } }),
      clearCache,
    });
    expect(result).toEqual({ ok: false });
    expect(clearCache).not.toHaveBeenCalled();
  });
});

describe("isSignOutTarget", () => {
  it("lets clicks on Sign out through the setup resume overlay", () => {
    const signOut = {
      closest: (selector: string) =>
        selector === "[data-sign-out]" ? signOut : null,
    };
    const other = { closest: () => null };
    expect(isSignOutTarget(signOut as unknown as EventTarget)).toBe(true);
    expect(isSignOutTarget(other as unknown as EventTarget)).toBe(false);
    expect(isSignOutTarget(null)).toBe(false);
  });
});

describe("incomplete setup always has a working Sign out", () => {
  const wizard = readFileSync("src/components/owner-setup-wizard.tsx", "utf8");
  const host = readFileSync("src/components/owner-onboarding-host.tsx", "utf8");
  const sidebar = readFileSync("src/components/app-sidebar.tsx", "utf8");
  const more = readFileSync("src/components/app/more-sheet.tsx", "utf8");

  it("shows Sign out in the setup modal", () => {
    expect(wizard).toContain("onSignOut");
    expect(wizard).toContain("Sign out");
    expect(wizard).toContain("data-sign-out");
    expect(host).toContain("onSignOut=");
  });

  it("does not mark the app shell inert while capturing clicks to resume", () => {
    expect(host).toMatch(/if \(wizardOpen\) root\.setAttribute\("inert"/);
    expect(host).not.toMatch(/captureClicks\s*\|\|\s*wizardOpen/);
  });

  it("does not treat account-menu Sign out as a resume click", () => {
    expect(wizard).toContain("isSignOutTarget");
    expect(sidebar).toContain("data-sign-out");
    expect(more).toContain("data-sign-out");
  });

  it("lands on /login after a successful sign-out", () => {
    const hook = readFileSync("src/hooks/use-sign-out.ts", "utf8");
    expect(hook).toContain("to: redirectTo");
    expect(hook).toContain('"/login"');
    expect(hook).toContain("qc.clear()");
  });
});
