import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkEmailCopy,
  GMAIL_INBOX_URL,
  OUTLOOK_INBOX_URL,
  remainingCooldown,
  RESEND_COOLDOWN_SECONDS,
  resendLabel,
} from "./check-your-email";

describe("check-your-email copy and cooldown", () => {
  it("uses a 60s resend cooldown", () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60);
    expect(remainingCooldown(0, 0)).toBe(60);
    expect(remainingCooldown(0, 59_000)).toBe(1);
    expect(remainingCooldown(0, 60_000)).toBe(0);
    expect(remainingCooldown(0, 90_000)).toBe(0);
  });

  it("labels the resend button with remaining seconds", () => {
    expect(resendLabel(0)).toBe("Resend email");
    expect(resendLabel(45)).toBe("Resend in 45s");
  });

  it("tells the user to open the link and check spam", () => {
    for (const kind of ["signup", "invite_signup", "recovery"] as const) {
      const copy = checkEmailCopy(kind);
      expect(copy.heading).toBe("Check your email");
      expect(copy.instruction.toLowerCase()).toContain("open");
      expect(copy.instruction.toLowerCase()).toContain("spam");
    }
  });

  it("opens Gmail and Outlook in the browser inbox", () => {
    expect(GMAIL_INBOX_URL).toBe("https://mail.google.com/");
    expect(OUTLOOK_INBOX_URL).toBe("https://outlook.live.com/mail/");
  });
});

describe("auth pages use the check-your-email panel", () => {
  const login = readFileSync("src/routes/login.tsx", "utf8");
  const join = readFileSync("src/routes/join.$token.tsx", "utf8");
  const forgot = readFileSync("src/routes/forgot-password.tsx", "utf8");

  it("replaces the signup toast on login and join", () => {
    expect(login).toContain("CheckYourEmail");
    expect(join).toContain("CheckYourEmail");
    expect(login).not.toMatch(/toast\.success\([\s\S]*Check your email/);
    expect(join).not.toMatch(/toast\.success\([\s\S]*check your email/);
  });

  it("uses the same panel after a password-reset email", () => {
    expect(forgot).toContain("CheckYourEmail");
    expect(forgot).toContain("recovery");
  });
});
