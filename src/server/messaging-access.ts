import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  callerCanReadMessages,
  callerCanWriteAttendance,
  callerCanWriteFees,
  callerCanWriteMessages,
} from "@/lib/messaging/workspace";
import type { WorkspaceRole } from "@/lib/workspace-roles";

export async function loadMembership(
  centreOwnerId: string,
  userId: string,
): Promise<{ role: WorkspaceRole; permissions: unknown } | null> {
  if (userId === centreOwnerId) return { role: "owner", permissions: {} };
  const { data, error } = await supabaseAdmin
    .from("workspace_members")
    .select("role, permissions")
    .eq("owner_id", centreOwnerId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    role: data.role as WorkspaceRole,
    permissions: data.permissions,
  };
}

export async function assertAttendanceWrite(
  centreOwnerId: string,
  userId: string,
): Promise<Response | null> {
  const membership = await loadMembership(centreOwnerId, userId);
  if (
    callerCanWriteAttendance({
      userId,
      centreOwnerId,
      membership,
    })
  ) {
    return null;
  }
  return Response.json(
    {
      ok: false,
      code: "FORBIDDEN_ATTENDANCE",
      message: "You don't have permission to mark attendance for this centre.",
    },
    { status: 403 },
  );
}

export async function assertFeesWrite(
  centreOwnerId: string,
  userId: string,
): Promise<Response | null> {
  const membership = await loadMembership(centreOwnerId, userId);
  if (
    callerCanWriteFees({
      userId,
      centreOwnerId,
      membership,
    })
  ) {
    return null;
  }
  return Response.json(
    {
      ok: false,
      code: "FORBIDDEN_FEES",
      message: "You don't have permission to record payments for this centre.",
    },
    { status: 403 },
  );
}

export async function assertMessagesWrite(
  centreOwnerId: string,
  userId: string,
): Promise<Response | null> {
  const membership = await loadMembership(centreOwnerId, userId);
  if (
    callerCanWriteMessages({
      userId,
      centreOwnerId,
      membership,
    })
  ) {
    return null;
  }
  return Response.json(
    {
      ok: false,
      code: "FORBIDDEN_MESSAGES",
      message: "You don't have permission to send parent WhatsApp messages.",
    },
    { status: 403 },
  );
}

export async function assertMessagesRead(
  centreOwnerId: string,
  userId: string,
): Promise<Response | null> {
  const membership = await loadMembership(centreOwnerId, userId);
  if (
    callerCanReadMessages({
      userId,
      centreOwnerId,
      membership,
    })
  ) {
    return null;
  }
  return Response.json(
    {
      ok: false,
      code: "FORBIDDEN_MESSAGES",
      message: "You don't have permission to view parent messages.",
    },
    { status: 403 },
  );
}
