import { describe, expect, it } from "vitest";
import { isAppleAuthEnabled } from "./feature-flags";

describe("isAppleAuthEnabled", () => {
  it("only enables when VITE_APPLE_AUTH_ENABLED is exactly 'true'", () => {
    expect(isAppleAuthEnabled("true")).toBe(true);
    expect(isAppleAuthEnabled("false")).toBe(false);
    expect(isAppleAuthEnabled("True")).toBe(false);
    expect(isAppleAuthEnabled("TRUE")).toBe(false);
    expect(isAppleAuthEnabled("1")).toBe(false);
    expect(isAppleAuthEnabled(true)).toBe(false);
    expect(isAppleAuthEnabled(undefined)).toBe(false);
    expect(isAppleAuthEnabled(null)).toBe(false);
    expect(isAppleAuthEnabled("")).toBe(false);
  });
});
