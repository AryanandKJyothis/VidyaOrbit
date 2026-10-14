import { describe, expect, it } from "vitest";
import {
  assertCanChangeRole,
  assertCanInviteRole,
  assertCanManageInvite,
  assertCanManageTeam,
  assertCanRemoveMember,
  assertWorkspaceOwner,
  inviteEmailMatches,
  inviteTokenSchema,
} from "./workspace-invite-rules";

describe("workspace invite rules", () => {
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

  it("lets owner and manager manage the team, not staff", () => {
    expect(() => assertCanManageTeam("owner")).not.toThrow();
    expect(() => assertCanManageTeam("manager")).not.toThrow();
    expect(() => assertCanManageTeam("staff")).toThrow(
      /Only the owner or a manager/,
    );
  });

  it("lets a manager invite staff but not a manager", () => {
    expect(() => assertCanInviteRole("manager", "staff")).not.toThrow();
    expect(() => assertCanInviteRole("manager", "manager")).toThrow(
      /Managers can invite staff/,
    );
    expect(() => assertCanInviteRole("owner", "manager")).not.toThrow();
    expect(() => assertCanInviteRole("staff", "staff")).toThrow();
  });

  it("lets only the owner change roles, never the owner row", () => {
    expect(() => assertCanChangeRole("owner", "staff")).not.toThrow();
    expect(() => assertCanChangeRole("owner", "manager")).not.toThrow();
    expect(() => assertCanChangeRole("owner", "owner")).toThrow(
      /Cannot modify the workspace owner/,
    );
    expect(() => assertCanChangeRole("manager", "staff")).toThrow(
      /Only the owner can change/,
    );
  });

  it("lets a manager remove staff but not the owner or another manager", () => {
    expect(() => assertCanRemoveMember("manager", "staff")).not.toThrow();
    expect(() => assertCanRemoveMember("manager", "owner")).toThrow(
      /Cannot remove the workspace owner/,
    );
    expect(() => assertCanRemoveMember("manager", "manager")).toThrow(
      /not the owner or other managers/,
    );
    expect(() => assertCanRemoveMember("owner", "manager")).not.toThrow();
  });

  it("lets a manager resend staff invites but not manager invites", () => {
    expect(() => assertCanManageInvite("manager", "staff")).not.toThrow();
    expect(() => assertCanManageInvite("manager", "manager")).toThrow(
      /staff invites/,
    );
    expect(() => assertCanManageInvite("owner", "manager")).not.toThrow();
  });
});
