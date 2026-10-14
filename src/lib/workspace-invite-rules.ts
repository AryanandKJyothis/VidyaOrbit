import { z } from "zod";
import {
  canChangeRole,
  canInviteRole,
  canManageInvite,
  canManageTeam,
  canRemoveMember,
  isInviteRole,
  type InviteRole,
  type WorkspaceRole,
} from "@/lib/workspace-roles";

export const inviteTokenSchema = z.string().min(10).max(200);

export function inviteEmailMatches(
  inviteEmail: string,
  userEmail: string,
): boolean {
  return inviteEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();
}

export function assertWorkspaceOwner(ownerId: string, userId: string): void {
  if (ownerId !== userId) {
    throw new Error("Only the workspace owner can perform this action");
  }
}

export function assertCanManageTeam(role: WorkspaceRole): void {
  if (!canManageTeam(role)) {
    throw new Error("Only the owner or a manager can manage the team");
  }
}

export function assertCanInviteRole(
  actor: WorkspaceRole,
  target: string,
): asserts target is InviteRole {
  if (!isInviteRole(target) || !canInviteRole(actor, target)) {
    throw new Error("You can't invite someone with that role");
  }
}

export function assertCanChangeRole(
  actor: WorkspaceRole,
  target: WorkspaceRole,
): void {
  if (target === "owner") {
    throw new Error("Cannot modify the workspace owner");
  }
  if (!canChangeRole(actor, target)) {
    throw new Error("You can't change this teammate's role");
  }
}

export function assertCanRemoveMember(
  actor: WorkspaceRole,
  target: WorkspaceRole,
): void {
  if (target === "owner") {
    throw new Error("Cannot remove the workspace owner");
  }
  if (!canRemoveMember(actor, target)) {
    throw new Error("You can't remove this teammate");
  }
}

export function assertCanManageInvite(
  actor: WorkspaceRole,
  inviteRole: WorkspaceRole,
): void {
  if (!canManageInvite(actor, inviteRole)) {
    throw new Error("You can't manage this invite");
  }
}
