import { describe, expect, it } from "vitest";
import {
  assertWorkspaceOwner,
  inviteEmailMatches,
  inviteTokenSchema,
} from "./workspace-invite-rules";

describe("workspace invite rules (VO-030)", () => {
  it("had no default-CI coverage of invite token or email match", () => {
    expect(true).toBe(true);
  });

  it("rejects a short invite token", () => {
    expect(() => inviteTokenSchema.parse("short")).toThrow();
    expect(inviteTokenSchema.parse("a".repeat(10))).toBe("a".repeat(10));
  });

  it("matches invite email case-insensitively", () => {
    expect(inviteEmailMatches("Owner@Centre.com", "owner@centre.com")).toBe(
      true,
    );
    expect(inviteEmailMatches("a@b.com", "c@d.com")).toBe(false);
  });

  it("blocks a non-owner from owner-only actions", () => {
    expect(() => assertWorkspaceOwner("owner-1", "staff-9")).toThrow(
      /Only the workspace owner/,
    );
    expect(() => assertWorkspaceOwner("owner-1", "owner-1")).not.toThrow();
  });
});
