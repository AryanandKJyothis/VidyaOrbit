import { describe, expect, it } from "vitest";
import {
  AUTH_CALLBACK_PATH,
  authCallbackUrl,
  parseAuthNext,
  safeAuthNextPath,
} from "./auth-callback";

describe("safeAuthNextPath", () => {
  it("defaults to the dashboard", () => {
    expect(safeAuthNextPath(undefined)).toBe("/dashboard");
    expect(safeAuthNextPath("")).toBe("/dashboard");
    expect(safeAuthNextPath("/login")).toBe("/dashboard");
  });

  it("keeps dashboard, invites, and join paths", () => {
    expect(safeAuthNextPath("/dashboard")).toBe("/dashboard");
    expect(safeAuthNextPath("/invites")).toBe("/invites");
    expect(safeAuthNextPath("/invites?token=abc_invite-01")).toBe(
      "/invites?token=abc_invite-01",
    );
    expect(safeAuthNextPath("/join/invite_token.1")).toBe(
      "/join/invite_token.1",
    );
  });

  it("rejects open redirects and traversal", () => {
    expect(safeAuthNextPath("//evil.example")).toBe("/dashboard");
    expect(safeAuthNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeAuthNextPath("/dashboard/../login")).toBe("/dashboard");
    expect(safeAuthNextPath("/join/../../login")).toBe("/dashboard");
    expect(safeAuthNextPath("\\login")).toBe("/dashboard");
  });
});

describe("authCallbackUrl", () => {
  it("points Google at the public callback with a safe next", () => {
    expect(authCallbackUrl("https://www.vidyaorbit.in", "/dashboard")).toBe(
      `https://www.vidyaorbit.in${AUTH_CALLBACK_PATH}?next=${encodeURIComponent("/dashboard")}`,
    );
    expect(
      authCallbackUrl("https://www.vidyaorbit.in", "https://evil.example"),
    ).toContain("next=%2Fdashboard");
  });
});

describe("parseAuthNext", () => {
  it("maps allowed paths to typed navigate targets", () => {
    expect(parseAuthNext("/dashboard")).toEqual({ kind: "dashboard" });
    expect(parseAuthNext("/invites?token=tok_123456")).toEqual({
      kind: "invites",
      token: "tok_123456",
    });
    expect(parseAuthNext("/join/tok_123456")).toEqual({
      kind: "join",
      token: "tok_123456",
    });
  });
});
