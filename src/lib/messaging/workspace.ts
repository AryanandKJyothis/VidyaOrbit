import {
  normalizePermissions,
  type PermissionLevel,
  type WorkspaceResource,
  type WorkspaceRole,
} from "@/lib/workspace-roles";

export function callerHasResource(args: {
  userId: string;
  centreOwnerId: string;
  membership: { role: WorkspaceRole; permissions?: unknown } | null;
  resource: WorkspaceResource;
  write: boolean;
}): boolean {
  if (args.userId === args.centreOwnerId) return true;
  if (!args.membership) return false;
  const permissions = normalizePermissions(
    args.membership.permissions,
    args.membership.role,
  );
  const level: PermissionLevel = permissions[args.resource];
  return args.write ? level === "write" : level === "read" || level === "write";
}

export function callerCanWriteAttendance(args: {
  userId: string;
  centreOwnerId: string;
  membership: { role: WorkspaceRole; permissions?: unknown } | null;
}): boolean {
  return callerHasResource({ ...args, resource: "attendance", write: true });
}

export function callerCanWriteMessages(args: {
  userId: string;
  centreOwnerId: string;
  membership: { role: WorkspaceRole; permissions?: unknown } | null;
}): boolean {
  return callerHasResource({ ...args, resource: "messages", write: true });
}

export function callerCanReadMessages(args: {
  userId: string;
  centreOwnerId: string;
  membership: { role: WorkspaceRole; permissions?: unknown } | null;
}): boolean {
  return callerHasResource({ ...args, resource: "messages", write: false });
}
