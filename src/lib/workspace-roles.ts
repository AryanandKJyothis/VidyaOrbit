/**
 * Centre staff roles for a workspace (e.g. APJ Academy).
 *
 * Three product roles:
 *   Owner / Director — full access. Only they can delete the centre;
 *     nobody can remove or demote them.
 *   Manager — everything else, including billing/plan (view, pay, change,
 *     invoices). Can invite, change, and remove staff or other managers,
 *     but never the owner.
 *   Staff — attendance, viewing students, recording fee payments.
 *           No billing, no staff management, no deleting students, no export.
 *
 * `viewer` remains in the DB enum for existing rows; it is not offered in the UI.
 * Permissions JSON is derived from the role on the server — clients cannot pick
 * a custom matrix. RLS still reads the JSON via has_resource_access.
 */

export const WORKSPACE_RESOURCES = [
  "students",
  "batches",
  "attendance",
  "fees",
  "settings",
  "billing",
] as const;

export const PERMISSION_LEVELS = ["none", "read", "write"] as const;

export const WORKSPACE_ROLES = ["owner", "manager", "staff", "viewer"] as const;

/** Roles that can be assigned when inviting or changing a member. */
export const INVITE_ROLES = ["manager", "staff"] as const;

export type WorkspaceResource = (typeof WORKSPACE_RESOURCES)[number];
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export type InviteRole = (typeof INVITE_ROLES)[number];

export type Permissions = Record<WorkspaceResource, PermissionLevel>;

export const OWNER_PERMISSIONS: Permissions = {
  students: "write",
  batches: "write",
  attendance: "write",
  fees: "write",
  settings: "write",
  billing: "write",
};

export const PERMISSION_PRESETS: Record<
  Exclude<WorkspaceRole, "owner">,
  Permissions
> = {
  manager: {
    students: "write",
    batches: "write",
    attendance: "write",
    fees: "write",
    settings: "write",
    billing: "write",
  },
  staff: {
    students: "read",
    batches: "read",
    attendance: "write",
    fees: "write",
    settings: "none",
    billing: "none",
  },
  viewer: {
    students: "read",
    batches: "read",
    attendance: "read",
    fees: "read",
    settings: "none",
    billing: "none",
  },
};

/** JSON stored on workspace_members / workspace_invites for the staff preset. */
export const STAFF_PERMISSIONS_JSON = JSON.stringify(PERMISSION_PRESETS.staff);
export const MANAGER_PERMISSIONS_JSON = JSON.stringify(
  PERMISSION_PRESETS.manager,
);

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner / Director",
  manager: "Manager",
  staff: "Staff",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<InviteRole, string> = {
  manager:
    "Runs the centre — students, attendance, fees, settings, staff, and billing. Cannot delete the centre or remove the owner.",
  staff:
    "Day-to-day work — mark attendance, view students, and record fee payments. Cannot manage staff, export data, or delete students.",
};

export function permissionsForRole(role: WorkspaceRole): Permissions {
  if (role === "owner") return OWNER_PERMISSIONS;
  return PERMISSION_PRESETS[role];
}

export function permissionsMatchPreset(
  p: Permissions,
  role: Exclude<WorkspaceRole, "owner">,
): boolean {
  const preset = PERMISSION_PRESETS[role];
  return WORKSPACE_RESOURCES.every((k) => p[k] === preset[k]);
}

export function detectPresetOrCustom(
  p: Permissions,
): Exclude<WorkspaceRole, "owner"> | "custom" {
  for (const r of ["manager", "staff", "viewer"] as const) {
    if (permissionsMatchPreset(p, r)) return r;
  }
  return "custom";
}

export function isInviteRole(role: string): role is InviteRole {
  return (INVITE_ROLES as readonly string[]).includes(role);
}

export function canManageTeam(role: WorkspaceRole): boolean {
  return role === "owner" || role === "manager";
}

export function canAccessBilling(role: WorkspaceRole): boolean {
  return role === "owner" || role === "manager";
}

export function canDeleteCentre(role: WorkspaceRole): boolean {
  return role === "owner";
}

export function canExportData(role: WorkspaceRole): boolean {
  return role === "owner" || role === "manager";
}

export function canDeleteStudents(role: WorkspaceRole): boolean {
  return role === "owner" || role === "manager";
}

export function canInviteRole(
  actor: WorkspaceRole,
  _target: InviteRole,
): boolean {
  return canManageTeam(actor);
}

/** Owner and manager may change manager/staff/viewer. Nobody can demote the owner. */
export function canChangeRole(
  actor: WorkspaceRole,
  target: WorkspaceRole,
): boolean {
  if (target === "owner") return false;
  return canManageTeam(actor);
}

/**
 * Owner and manager may remove anyone except the owner.
 * Nobody can remove or demote the owner.
 */
export function canRemoveMember(
  actor: WorkspaceRole,
  target: WorkspaceRole,
): boolean {
  if (target === "owner") return false;
  return canManageTeam(actor);
}

/** Resend/revoke a pending invite — same scope as removing that role. */
export function canManageInvite(
  actor: WorkspaceRole,
  inviteRole: WorkspaceRole,
): boolean {
  return canRemoveMember(actor, inviteRole);
}

export type RoleCapability =
  | "billing"
  | "delete_centre"
  | "manage_team"
  | "invite_staff"
  | "invite_manager"
  | "change_roles"
  | "remove_staff"
  | "remove_owner"
  | "delete_students"
  | "export_data"
  | "view_students"
  | "edit_students"
  | "attendance"
  | "record_fees"
  | "edit_settings";

const ROLE_CAPABILITIES: Record<WorkspaceRole, ReadonlySet<RoleCapability>> = {
  owner: new Set([
    "billing",
    "delete_centre",
    "manage_team",
    "invite_staff",
    "invite_manager",
    "change_roles",
    "remove_staff",
    "delete_students",
    "export_data",
    "view_students",
    "edit_students",
    "attendance",
    "record_fees",
    "edit_settings",
  ]),
  manager: new Set([
    "billing",
    "manage_team",
    "invite_staff",
    "invite_manager",
    "change_roles",
    "remove_staff",
    "delete_students",
    "export_data",
    "view_students",
    "edit_students",
    "attendance",
    "record_fees",
    "edit_settings",
  ]),
  staff: new Set(["view_students", "attendance", "record_fees"]),
  viewer: new Set(["view_students"]),
};

export function roleHasCapability(
  role: WorkspaceRole,
  capability: RoleCapability,
): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}
