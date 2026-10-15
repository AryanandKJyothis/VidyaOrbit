import { describe, expect, it } from "vitest";
import { isAppShellPath } from "./public-chrome";

describe("isAppShellPath", () => {
  it("hides marketing chrome on authenticated app routes", () => {
    expect(isAppShellPath("/dashboard")).toBe(true);
    expect(isAppShellPath("/students/abc")).toBe(true);
    expect(isAppShellPath("/settings/team")).toBe(true);
    expect(isAppShellPath("/receipts/pay_1")).toBe(true);
    expect(isAppShellPath("/admin")).toBe(true);
  });

  it("keeps marketing chrome on public pages", () => {
    expect(isAppShellPath("/")).toBe(false);
    expect(isAppShellPath("/home")).toBe(false);
    expect(isAppShellPath("/pricing")).toBe(false);
    expect(isAppShellPath("/login")).toBe(false);
    expect(isAppShellPath("/privacy")).toBe(false);
  });
});
