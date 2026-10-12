import { describe, expect, it } from "vitest";
import { importContactIssue, issueLabel } from "./student-import";

describe("import contact phone (VO-032)", () => {
  it("allowed a blank phone before the fix", () => {
    const before = (phone: string, guardian: string) => {
      if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) return "invalid_phone";
      return null;
    };
    expect(before("", "")).toBeNull();
  });

  it("rejects import rows with no student or guardian phone", () => {
    expect(importContactIssue(null, null)).toBe("missing_phone");
    expect(importContactIssue("", "")).toBe("missing_phone");
    expect(issueLabel("missing_phone")).toBe(
      "Phone or guardian phone required",
    );
  });

  it("accepts a guardian phone when the student phone is blank", () => {
    expect(importContactIssue("", "9876543210")).toBeNull();
  });

  it("rejects a malformed phone when no valid contact exists", () => {
    expect(importContactIssue("12", "")).toBe("invalid_phone");
  });
});
