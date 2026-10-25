import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isGoogleAuthEnabled } from "./feature-flags";
import { signupSchema } from "./validation";

const login = readFileSync("src/routes/login.tsx", "utf8");
const router = readFileSync("src/router.tsx", "utf8");
const authenticated = readFileSync("src/routes/_authenticated.tsx", "utf8");
const index = readFileSync("src/routes/index.tsx", "utf8");
const students = readFileSync("src/routes/_authenticated/students.tsx", "utf8");
const batches = readFileSync("src/routes/_authenticated/batches.tsx", "utf8");
const attendance = readFileSync(
  "src/routes/_authenticated/attendance.tsx",
  "utf8",
);
const fees = readFileSync("src/routes/_authenticated/fees.tsx", "utf8");
const checklist = readFileSync(
  "src/components/onboarding-checklist.tsx",
  "utf8",
);
const onboardingLib = readFileSync("src/lib/owner-onboarding.ts", "utf8");
const setupPrompt = readFileSync("src/components/setup-prompt.tsx", "utf8");
const host = readFileSync("src/components/owner-onboarding-host.tsx", "utf8");
const checkEmail = readFileSync("src/components/check-your-email.tsx", "utf8");

describe("W1.1 signup required fields", () => {
  it("requires only email and password; phone is not a signup field", () => {
    expect(login).toContain("signupSchema");
    expect(login).toContain('id: "email"');
    expect(login).toContain('id: "password"');
    expect(login).toContain('id: "institute_name"');
    expect(login).toContain("required: false");
    expect(login).not.toMatch(/id:\s*"phone"/);
    expect(login).not.toMatch(/requiredPhone\(/);
    expect(
      signupSchema.safeParse({ email: "a@b.in", password: "password1" })
        .success,
    ).toBe(true);
  });
});

describe("W1.2 Google SSO stays off", () => {
  it("does not enable Google unless the exact env flag is true", () => {
    expect(isGoogleAuthEnabled("true")).toBe(true);
    expect(isGoogleAuthEnabled(undefined)).toBe(false);
    expect(login).toContain("GOOGLE_AUTH_ENABLED &&");
    expect(login).not.toContain("VITE_GOOGLE_AUTH_ENABLED=true");
  });
});

describe("W1.3 verify panel", () => {
  it("sends confirmations through the auth callback and offers inbox links", () => {
    expect(login).toContain("authCallbackUrl");
    expect(login).toContain("CheckYourEmail");
    expect(checkEmail).toContain("GMAIL_INBOX_URL");
    expect(checkEmail).toContain("OUTLOOK_INBOX_URL");
    expect(checkEmail).toContain("Open Gmail");
    expect(checkEmail).toContain("Open Outlook");
    expect(checkEmail).toContain("resendLabel");
  });
});

describe("W1.4 one institute-name path", () => {
  it("uses SetupPrompt only when the name is still the default", () => {
    expect(setupPrompt).toContain("shouldShowSetupPrompt");
    expect(setupPrompt).toContain("readInstituteNameFromMetadata");
    expect(setupPrompt).not.toMatch(/inst\.data\.name === "My Institute"/);
    expect(host).toContain("<SetupPrompt");
  });
});

describe("W1.5 checklist is three value steps", () => {
  it("starts at 0/3 and makes Import the primary CTA", () => {
    expect(checklist).toContain("checklistFromCounts");
    expect(checklist).toContain("step.primary");
    expect(checklist).not.toContain("Sparkles");
    expect(onboardingLib).toContain('id: "student"');
    expect(onboardingLib).toContain('label: "Import"');
    expect(onboardingLib).toContain(
      "input.attendanceStarted || input.paymentCount > 0",
    );
    expect(onboardingLib).not.toMatch(/doneCount \+= .*isRealInstituteName/);
  });
});

describe("W1.6 empty states", () => {
  it("gives each list one primary CTA and no LMS / parent-app / biometric sell", () => {
    expect(students).toContain("Import students");
    expect(students).toContain("reassurance=");
    expect(students).not.toMatch(/parent app|biometric|LMS|live class/i);
    expect(batches).toContain("New batch");
    expect(batches).toContain("reassurance=");
    expect(attendance).toContain("reassurance=");
    expect(fees).toContain("reassurance=");
    expect(fees).not.toMatch(/parent app|biometric|LMS/i);
  });
});

describe("W1.7 no full-screen loader gate", () => {
  it("uses inline pending on the router and authenticated shell", () => {
    expect(router).toContain("InlinePending");
    expect(router).toContain("defaultPendingComponent");
    expect(router).not.toContain("LoadingScreen");
    expect(authenticated).toContain("InlinePending");
    expect(authenticated).not.toContain("LoadingScreen");
    expect(index).not.toContain("LoadingScreen");
  });
});
