import { describe, expect, it } from "vitest";
import { MOBILE_NAV_ITEMS } from "./mobile-nav";

describe("mobile nav (VO-027)", () => {
  it("omitted Attendance before the fix (Plan took the fourth slot)", () => {
    const before = ["Dashboard", "Students", "Fees", "Plan"];
    expect(before).not.toContain("Attendance");
    expect(before).toContain("Plan");
  });

  it("puts Attendance on the phone bar", () => {
    const labels = MOBILE_NAV_ITEMS.map((item) => item.label);
    const hrefs = MOBILE_NAV_ITEMS.map((item) => item.to);
    expect(labels).toContain("Attendance");
    expect(hrefs).toContain("/attendance");
    expect(labels).not.toContain("Plan");
  });
});
