import { canAccessBilling, type WorkspaceRole } from "@/lib/workspace-roles";

/**
 * Who may view, pay, change, or read invoices for a centre.
 * The centre owner always can. A manager of that workspace can.
 * Staff cannot — even if they somehow send the owner's id.
 */
export function callerCanBillForCentre(args: {
  userId: string;
  centreOwnerId: string;
  membershipRole: WorkspaceRole | null;
}): boolean {
  if (args.userId === args.centreOwnerId) return true;
  if (!args.membershipRole) return false;
  return canAccessBilling(args.membershipRole);
}
