import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  assertCanChangeRole,
  assertCanInviteRole,
  assertCanManageInvite,
  assertCanManageTeam,
  assertCanRemoveMember,
  inviteEmailMatches,
  inviteTokenSchema,
} from "@/lib/workspace-invite-rules";
import {
  canManageTeam,
  normalizePermissions,
  permissionsForRole,
  type Permissions,
  type WorkspaceRole,
} from "@/lib/workspace-roles";

export {
  INVITE_ROLES,
  PERMISSION_PRESETS,
  detectPresetOrCustom,
  permissionsForRole,
  permissionsMatchPreset,
} from "@/lib/workspace-roles";
export type { Permissions, WorkspaceRole } from "@/lib/workspace-roles";

async function callerMembership(ownerId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("role")
    .eq("owner_id", ownerId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Not a member of this workspace");
  return data.role as WorkspaceRole;
}

// ============ Workspaces a user belongs to ============
export const listMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: members, error } = await supabase
      .from("workspace_members")
      .select("owner_id, role, permissions, created_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    const ownerIds = (members ?? []).map((m) => m.owner_id);
    let names: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: insts } = await supabase
        .from("institutes")
        .select("owner_id, name")
        .in("owner_id", ownerIds);
      names = Object.fromEntries(
        (insts ?? []).map((i) => [i.owner_id, i.name]),
      );
    }
    return (members ?? []).map((m) => ({
      ownerId: m.owner_id,
      role: m.role as WorkspaceRole,
      permissions: normalizePermissions(
        m.permissions,
        m.role as WorkspaceRole,
      ),
      name: names[m.owner_id] ?? "Workspace",
      isOwn: m.owner_id === userId,
    }));
  });

// ============ Unified team list (members + pending invites) ============
// Returns one ordered roster so the UI doesn't have to manage two tables.
// Every member sees the roster; owner and manager also see pending invites.
export const listTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { ownerId: string }) =>
    z.object({ ownerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const callerRole = await callerMembership(data.ownerId, context.userId);
    const isOwner = callerRole === "owner" || data.ownerId === context.userId;
    const canManage = canManageTeam(callerRole);

    const { data: members, error } = await supabaseAdmin
      .from("workspace_members")
      .select("id, user_id, role, permissions, created_at")
      .eq("owner_id", data.ownerId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    // Fetch emails for all members. Page through listUsers to avoid the 200-user limit.
    const idSet = new Set((members ?? []).map((m) => m.user_id));
    const emails: Record<string, string> = {};
    const lastSignIn: Record<string, string | null> = {};
    if (idSet.size > 0) {
      let page = 1;
      const maxPages = 50; // Safety cap: 10,000 users max
      let hasMore = true;
      while (
        hasMore &&
        page <= maxPages &&
        idSet.size > Object.keys(emails).length
      ) {
        const { data: usersPage, error: usersError } =
          await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: 200,
          });
        // Break on error or empty response
        if (usersError || !usersPage?.users || usersPage.users.length === 0) {
          break;
        }
        for (const u of usersPage.users) {
          if (idSet.has(u.id)) {
            emails[u.id] = u.email ?? "";
            lastSignIn[u.id] = (u.last_sign_in_at as string | null) ?? null;
          }
        }
        // Stop if we've found all members or if this page was incomplete
        hasMore =
          usersPage.users.length === 200 &&
          Object.keys(emails).length < idSet.size;
        page++;
      }
    }

    type Row =
      | {
          kind: "member";
          id: string;
          email: string;
          role: WorkspaceRole;
          permissions: Permissions;
          status: "active";
          lastActive: string | null;
          createdAt: string;
          isYou: boolean;
        }
      | {
          kind: "invite";
          id: string;
          email: string;
          role: WorkspaceRole;
          permissions: Permissions;
          status: "pending" | "expired";
          token: string | null; // null unless the caller can manage invites
          expiresAt: string;
          createdAt: string;
        };

    const memberRows: Row[] = (members ?? []).map((m) => ({
      kind: "member" as const,
      id: m.id,
      email: emails[m.user_id] ?? "",
      role: m.role as WorkspaceRole,
      permissions: normalizePermissions(
        m.permissions,
        m.role as WorkspaceRole,
      ),
      status: "active" as const,
      lastActive: lastSignIn[m.user_id] ?? null,
      createdAt: m.created_at,
      isYou: m.user_id === context.userId,
    }));

    let inviteRows: Row[] = [];
    if (canManage) {
      const { data: invites } = await supabaseAdmin
        .from("workspace_invites")
        .select(
          "id, email, role, permissions, status, expires_at, created_at, token",
        )
        .eq("owner_id", data.ownerId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      const now = Date.now();
      inviteRows = (invites ?? []).map((i) => ({
        kind: "invite" as const,
        id: i.id,
        email: i.email,
        role: i.role as WorkspaceRole,
        permissions: normalizePermissions(
          i.permissions,
          i.role as WorkspaceRole,
        ),
        status:
          new Date(i.expires_at).getTime() <= now
            ? ("expired" as const)
            : ("pending" as const),
        token: i.token,
        expiresAt: i.expires_at,
        createdAt: i.created_at,
      }));
    }

    return {
      isOwner,
      canManage,
      callerRole,
      rows: [...memberRows, ...inviteRows],
    };
  });

// ============ Invite a member ============
export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        ownerId: z.string().uuid(),
        email: z.string().trim().toLowerCase().email().max(255),
        role: z.enum(["manager", "staff"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const callerRole = await callerMembership(data.ownerId, context.userId);
    assertCanManageTeam(callerRole);
    assertCanInviteRole(callerRole, data.role);

    // Block duplicate active member by checking against existing members.
    const { data: existingMembers } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id")
      .eq("owner_id", data.ownerId);
    if (existingMembers && existingMembers.length > 0) {
      const idSet = new Set(existingMembers.map((m) => m.user_id));
      // Page through all users to find existing member emails
      let page = 1;
      const maxPages = 50; // Safety cap: 10,000 users max
      let hasMore = true;
      const existingEmails = new Set<string>();
      while (hasMore && page <= maxPages && existingEmails.size < idSet.size) {
        const { data: usersPage, error: usersError } =
          await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: 200,
          });
        // Break on error or empty response
        if (usersError || !usersPage?.users || usersPage.users.length === 0) {
          break;
        }
        for (const u of usersPage.users) {
          if (idSet.has(u.id)) {
            existingEmails.add((u.email ?? "").toLowerCase());
          }
        }
        hasMore =
          usersPage.users.length === 200 && existingEmails.size < idSet.size;
        page++;
      }
      if (existingEmails.has(data.email)) {
        throw new Error("This person is already a member of the workspace");
      }
    }

    // Revoke any existing pending invites for this email
    await supabaseAdmin
      .from("workspace_invites")
      .update({ status: "revoked" })
      .eq("owner_id", data.ownerId)
      .eq("status", "pending")
      .ilike("email", data.email);

    const token = randomBytes(32).toString("base64url");
    const { data: invite, error } = await supabaseAdmin
      .from("workspace_invites")
      .insert({
        owner_id: data.ownerId,
        email: data.email,
        role: data.role,
        permissions: permissionsForRole(data.role),
        token,
        invited_by: context.userId,
      })
      .select("id, token, email, role, expires_at")
      .single();
    if (error) throw new Error(error.message);
    return invite;
  });

// ============ Resend invite (rotates token + extends expiry) ============
export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { inviteId: string }) =>
    z.object({ inviteId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: invite } = await supabaseAdmin
      .from("workspace_invites")
      .select("id, owner_id, email, status, role")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (!invite) throw new Error("Invite not found");
    const callerRole = await callerMembership(invite.owner_id, context.userId);
    assertCanManageTeam(callerRole);
    assertCanManageInvite(callerRole, invite.role as WorkspaceRole);

    const token = randomBytes(32).toString("base64url");
    const expires = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { error } = await supabaseAdmin
      .from("workspace_invites")
      .update({ token, expires_at: expires, status: "pending" })
      .eq("id", invite.id);
    if (error) throw new Error(error.message);
    return { token, email: invite.email, expiresAt: expires };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { inviteId: string }) =>
    z.object({ inviteId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: invite } = await supabaseAdmin
      .from("workspace_invites")
      .select("owner_id, status, role")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (!invite) throw new Error("Invite not found");
    const callerRole = await callerMembership(invite.owner_id, context.userId);
    assertCanManageTeam(callerRole);
    assertCanManageInvite(callerRole, invite.role as WorkspaceRole);
    if (invite.status !== "pending") throw new Error("Invite is not pending");
    const { error } = await supabaseAdmin
      .from("workspace_invites")
      .update({ status: "revoked" })
      .eq("id", data.inviteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Public: preview invite (no auth required) ============
// Lets the /join/$token landing page show "X invited you to join Y as Staff"
// to brand-new users before they sign up. Returns only non-sensitive fields.
export const previewInvite = createServerFn({ method: "POST" })
  .validator((input: { token: string }) =>
    z.object({ token: inviteTokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: invite } = await supabaseAdmin
      .from("workspace_invites")
      .select("owner_id, email, role, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) return { ok: false as const, reason: "not_found" as const };
    const expired = new Date(invite.expires_at).getTime() <= Date.now();
    if (invite.status !== "pending") {
      return {
        ok: false as const,
        reason: invite.status as "accepted" | "revoked" | "expired",
      };
    }
    if (expired) return { ok: false as const, reason: "expired" as const };

    const { data: inst } = await supabaseAdmin
      .from("institutes")
      .select("name")
      .eq("owner_id", invite.owner_id)
      .maybeSingle();

    return {
      ok: true as const,
      workspaceName: inst?.name ?? "Workspace",
      email: invite.email,
      role: invite.role as WorkspaceRole,
      expiresAt: invite.expires_at,
    };
  });

// ============ Invitee: list my pending invites ============
export const listMyPendingInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String(context.claims.email ?? "").toLowerCase();
    if (!email) return [];

    // Check if user's email is confirmed by fetching full user record
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (userError || !userData?.user) {
      console.warn(
        `Failed to fetch user ${context.userId} for invite check:`,
        userError,
      );
      return []; // Return empty list if we can't verify, don't block the page
    }

    // Silently return empty list if email not confirmed
    if (!userData.user.email_confirmed_at) {
      return [];
    }

    const { data: invites, error } = await context.supabase
      .from("workspace_invites")
      .select("id, owner_id, role, permissions, expires_at, created_at, token")
      .eq("status", "pending")
      .ilike("email", email);
    if (error) throw new Error(error.message);

    const ownerIds = (invites ?? []).map((i) => i.owner_id);
    let names: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: insts } = await context.supabase
        .from("institutes")
        .select("owner_id, name")
        .in("owner_id", ownerIds);
      names = Object.fromEntries(
        (insts ?? []).map((i) => [i.owner_id, i.name]),
      );
    }
    return (invites ?? [])
      .filter((i) => new Date(i.expires_at) > new Date())
      .map((i) => ({ ...i, workspaceName: names[i.owner_id] ?? "Workspace" }));
  });

// ============ Accept invite ============
export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { token: string }) =>
    z.object({ token: inviteTokenSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const userEmail = String(context.claims.email ?? "").toLowerCase();
    if (!userEmail) throw new Error("Your account has no email address");

    // Check if user's email is confirmed by fetching full user record
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (userError || !userData?.user) {
      throw new Error(
        "Could not verify your account. Please try again or contact support.",
      );
    }

    if (!userData.user.email_confirmed_at) {
      throw new Error(
        "Please verify your email address before accepting invites. Check your inbox for the verification link.",
      );
    }

    const { data: invite } = await supabaseAdmin
      .from("workspace_invites")
      .select("id, owner_id, email, role, permissions, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) throw new Error("Invite not found");
    if (invite.status !== "pending")
      throw new Error("Invite is no longer valid");
    if (new Date(invite.expires_at) <= new Date()) {
      await supabaseAdmin
        .from("workspace_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);
      throw new Error("Invite has expired");
    }
    if (!inviteEmailMatches(invite.email, userEmail)) {
      throw new Error("This invite was sent to a different email address");
    }

    const { error: insertErr } = await supabaseAdmin
      .from("workspace_members")
      .upsert(
        {
          owner_id: invite.owner_id,
          user_id: context.userId,
          role: invite.role,
          permissions: permissionsForRole(invite.role as WorkspaceRole),
          invited_by: invite.owner_id,
        },
        { onConflict: "owner_id,user_id" },
      );
    if (insertErr) throw new Error(insertErr.message);

    await supabaseAdmin
      .from("workspace_invites")
      .update({
        status: "accepted",
        accepted_by: context.userId,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    return { ok: true, ownerId: invite.owner_id };
  });

export const declineInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { token: string }) =>
    z.object({ token: inviteTokenSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const userEmail = String(context.claims.email ?? "").toLowerCase();
    const { data: invite } = await supabaseAdmin
      .from("workspace_invites")
      .select("id, email, status")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) throw new Error("Invite not found");
    if (!inviteEmailMatches(invite.email, userEmail))
      throw new Error("Not your invite");
    if (invite.status !== "pending")
      throw new Error("Invite is no longer pending");
    await supabaseAdmin
      .from("workspace_invites")
      .update({ status: "revoked" })
      .eq("id", invite.id);
    return { ok: true };
  });

// ============ Update member ============
export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        memberId: z.string().uuid(),
        role: z.enum(["manager", "staff"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: m } = await supabaseAdmin
      .from("workspace_members")
      .select("owner_id, user_id, role")
      .eq("id", data.memberId)
      .maybeSingle();
    if (!m) throw new Error("Member not found");
    const callerRole = await callerMembership(m.owner_id, context.userId);
    assertCanManageTeam(callerRole);
    assertCanChangeRole(callerRole, m.role as WorkspaceRole);
    const { error } = await supabaseAdmin
      .from("workspace_members")
      .update({
        role: data.role,
        permissions: permissionsForRole(data.role),
      })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Remove member ============
export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { memberId: string }) =>
    z.object({ memberId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: m } = await supabaseAdmin
      .from("workspace_members")
      .select("owner_id, role")
      .eq("id", data.memberId)
      .maybeSingle();
    if (!m) throw new Error("Member not found");
    const callerRole = await callerMembership(m.owner_id, context.userId);
    assertCanManageTeam(callerRole);
    assertCanRemoveMember(callerRole, m.role as WorkspaceRole);
    const { error } = await supabaseAdmin
      .from("workspace_members")
      .delete()
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Leave a workspace (member removes themselves) ============
// Used by the workspace switcher to remove an institute you were invited to
// from your own list. Owners cannot leave their own workspace (that would
// orphan all institute data); they must contact support to delete the account.
export const leaveWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { ownerId: string }) =>
    z.object({ ownerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.ownerId === context.userId) {
      throw new Error(
        "You can't leave your own institute. Contact support to delete it.",
      );
    }
    const { error } = await supabaseAdmin
      .from("workspace_members")
      .delete()
      .eq("owner_id", data.ownerId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
