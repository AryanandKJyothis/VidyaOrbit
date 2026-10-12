import { z } from "zod";

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
