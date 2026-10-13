import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loadingScreen = readFileSync("src/components/loading-screen.tsx", "utf8");
const authenticated = readFileSync("src/routes/_authenticated.tsx", "utf8");
const callback = readFileSync("src/routes/auth.callback.tsx", "utf8");
const wizard = readFileSync("src/components/owner-setup-wizard.tsx", "utf8");
const dashboard = readFileSync(
  "src/routes/_authenticated/dashboard.tsx",
  "utf8",
);
const students = readFileSync("src/routes/_authenticated/students.tsx", "utf8");
const googleAuth = readFileSync("src/lib/google-auth.ts", "utf8");

describe("branded loader usage", () => {
  it("exposes an accessible status loader with a label", () => {
    expect(loadingScreen).toContain('role="status"');
    expect(loadingScreen).toContain("aria-label={label}");
    expect(loadingScreen).toContain("brand-loader-orbit");
  });

  it("covers OAuth callback, first workspace boot, and setup save", () => {
    expect(callback).toContain("LoadingScreen");
    expect(callback).toContain("Signing you in");
    expect(googleAuth).toContain("authCallbackUrl");
    expect(authenticated).toContain("WorkspaceBootGate");
    expect(authenticated).toContain("Preparing your workspace");
    expect(wizard).toContain("BrandLoaderOverlay");
    expect(wizard).toContain("Saving your setup");
  });

  it("leaves per-section skeletons in place", () => {
    expect(dashboard).toContain("QueryLoadingSkeleton");
    expect(dashboard).toContain("<Skeleton");
    expect(students).toContain("<Skeleton");
    expect(dashboard).not.toContain("BrandLoader");
    expect(students).not.toContain("LoadingScreen");
  });
});
