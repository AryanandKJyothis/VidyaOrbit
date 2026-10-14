import { describe, expect, it } from "vitest";
import {
  PERMISSION_PRESETS,
  ROLE_LABELS,
  canAccessBilling,
  canChangeRole,
  canDeleteCentre,
  canDeleteStudents,
  canExportData,
  canInviteRole,
  canManageInvite,
  canManageTeam,
  canRemoveMember,
  permissionsForRole,
  roleHasCapability,
  type RoleCapability,
  type WorkspaceRole,
} from "./workspace-roles";

const ROLES: WorkspaceRole[] = ["owner", "manager", "staff", "viewer"];

const FORBIDDEN_FOR_STAFF: RoleCapability[] = [
  "billing",
  "delete_centre",
  "manage_team",
  "invite_staff",
  "invite_manager",
  "change_roles",
  "remove_staff",
  "remove_owner",
  "delete_students",
  "export_data",
  "edit_students",
  "edit_settings",
];

describe("workspace role labels", () => {
  it("names the owner as Owner / Director", () => {
    expect(ROLE_LABELS.owner).toBe("Owner / Director");
    expect(ROLE_LABELS.manager).toBe("Manager");
    expect(ROLE_LABELS.staff).toBe("Staff");
  });
});

describe("permission presets", () => {
  it("gives the owner full write including billing", () => {
    const p = permissionsForRole("owner");
    expect(p).toEqual({
      students: "write",
      batches: "write",
      attendance: "write",
      fees: "write",
      settings: "write",
      billing: "write",
    });
  });

  it("gives the manager write everywhere including billing", () => {
    expect(PERMISSION_PRESETS.manager.billing).toBe("write");
    expect(PERMISSION_PRESETS.manager.settings).toBe("write");
    expect(PERMISSION_PRESETS.manager.students).toBe("write");
    expect(permissionsForRole("manager")).toEqual(PERMISSION_PRESETS.manager);
  });

  it("gives staff view-only students, write attendance and fees, no settings or billing", () => {
    expect(PERMISSION_PRESETS.staff).toEqual({
      students: "read",
      batches: "read",
      attendance: "write",
      fees: "write",
      settings: "none",
      billing: "none",
    });
  });
});

describe("role capabilities matrix", () => {
  it("lets owner and manager bill; only the owner can delete the centre", () => {
    expect(canAccessBilling("owner")).toBe(true);
    expect(canAccessBilling("manager")).toBe(true);
    expect(canAccessBilling("staff")).toBe(false);
    expect(canDeleteCentre("owner")).toBe(true);
    expect(canDeleteCentre("manager")).toBe(false);
    expect(canDeleteCentre("staff")).toBe(false);
    expect(canInviteRole("owner", "manager")).toBe(true);
    expect(canInviteRole("manager", "manager")).toBe(true);
  });

  it("lets owner and manager export and delete students; staff cannot", () => {
    expect(canExportData("owner")).toBe(true);
    expect(canExportData("manager")).toBe(true);
    expect(canExportData("staff")).toBe(false);
    expect(canDeleteStudents("owner")).toBe(true);
    expect(canDeleteStudents("manager")).toBe(true);
    expect(canDeleteStudents("staff")).toBe(false);
  });

  it("lets owner and manager manage the team; staff cannot", () => {
    expect(canManageTeam("owner")).toBe(true);
    expect(canManageTeam("manager")).toBe(true);
    expect(canManageTeam("staff")).toBe(false);
  });

  it("never lets anyone remove or change the owner", () => {
    for (const actor of ROLES) {
      expect(canRemoveMember(actor, "owner")).toBe(false);
      expect(canChangeRole(actor, "owner")).toBe(false);
      expect(roleHasCapability(actor, "remove_owner")).toBe(false);
    }
  });

  it("lets the owner change and remove manager and staff", () => {
    expect(canChangeRole("owner", "manager")).toBe(true);
    expect(canChangeRole("owner", "staff")).toBe(true);
    expect(canRemoveMember("owner", "manager")).toBe(true);
    expect(canRemoveMember("owner", "staff")).toBe(true);
  });

  it("lets the manager invite, change, and remove staff or managers, but never the owner", () => {
    expect(canInviteRole("manager", "staff")).toBe(true);
    expect(canInviteRole("manager", "manager")).toBe(true);
    expect(canRemoveMember("manager", "staff")).toBe(true);
    expect(canRemoveMember("manager", "manager")).toBe(true);
    expect(canChangeRole("manager", "staff")).toBe(true);
    expect(canChangeRole("manager", "manager")).toBe(true);
    expect(canChangeRole("manager", "owner")).toBe(false);
    expect(canManageInvite("manager", "staff")).toBe(true);
    expect(canManageInvite("manager", "manager")).toBe(true);
    expect(roleHasCapability("manager", "billing")).toBe(true);
    expect(roleHasCapability("manager", "delete_centre")).toBe(false);
    expect(roleHasCapability("manager", "remove_owner")).toBe(false);
  });

  it("denies staff every management, billing, export, and delete capability", () => {
    for (const cap of FORBIDDEN_FOR_STAFF) {
      expect(roleHasCapability("staff", cap)).toBe(false);
    }
    expect(roleHasCapability("staff", "view_students")).toBe(true);
    expect(roleHasCapability("staff", "attendance")).toBe(true);
    expect(roleHasCapability("staff", "record_fees")).toBe(true);
  });

  it("gives the owner every listed capability except removing themselves", () => {
    const ownerCaps: RoleCapability[] = [
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
    ];
    for (const cap of ownerCaps) {
      expect(roleHasCapability("owner", cap)).toBe(true);
    }
  });
});
