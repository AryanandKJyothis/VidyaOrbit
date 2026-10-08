import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  UserPlus,
  MoreHorizontal,
  Trash2,
  Settings as Cog,
  Copy,
  Send,
  MessageCircle,
  Mail,
} from "lucide-react";
import { RoutePermissionGate } from "@/components/route-permission-gate";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import {
  RolePermissionPicker,
  EmailField,
} from "@/components/role-permission-picker";
import {
  listTeam,
  inviteMember,
  revokeInvite,
  resendInvite,
  updateMember,
  removeMember,
  PERMISSION_PRESETS,
  type Permissions,
  type WorkspaceRole,
} from "@/lib/workspace.functions";
import { formatUserError } from "@/lib/format-error";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings/team")({
  component: TeamPage,
});

type TeamRow = Awaited<ReturnType<typeof listTeam>>["rows"][number];

function joinUrl(token: string) {
  return `${window.location.origin}/join/${token}`;
}

function statusBadge(row: TeamRow) {
  if (row.kind === "member") {
    return (
      <Badge
        variant="secondary"
        className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
      >
        Active
      </Badge>
    );
  }
  if (row.status === "expired") {
    return (
      <Badge
        variant="secondary"
        className="bg-amber-100 text-amber-800 hover:bg-amber-100"
      >
        Link expired
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="bg-sky-100 text-sky-700 hover:bg-sky-100"
    >
      Invite sent
    </Badge>
  );
}

function roleLabel(role: WorkspaceRole) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function lastActiveLabel(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function TeamPage() {
  return (
    <RoutePermissionGate resource="settings" level="read">
      <TeamPageContent />
    </RoutePermissionGate>
  );
}

function TeamPageContent() {
  const { active } = useActiveWorkspace();
  const ownerId = active?.ownerId ?? "";

  const fetchTeam = useServerFn(listTeam);
  const qc = useQueryClient();

  const team = useQuery({
    queryKey: ["team", ownerId],
    enabled: !!ownerId,
    queryFn: () => fetchTeam({ data: { ownerId } }),
    staleTime: 30_000,
  });

  const isOwner = !!team.data?.isOwner;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TeamRow | null>(null);

  if (!active) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description={
          isOwner
            ? "Invite people into your workspace and control what they can do."
            : "People who can access this workspace alongside you."
        }
        actions={
          isOwner ? (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Invite teammate
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-0">
          {team.isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Last active
                  </TableHead>
                  {isOwner && (
                    <TableHead className="w-12 text-right"></TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(team.data?.rows ?? []).map((row) => (
                  <TableRow key={`${row.kind}:${row.id}`}>
                    <TableCell>
                      <div className="font-medium">
                        {row.email || "(unknown)"}
                        {row.kind === "member" && row.isYou && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.role === "owner" ? "default" : "outline"}
                      >
                        {roleLabel(row.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>{statusBadge(row)}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {row.kind === "member"
                        ? lastActiveLabel(row.lastActive)
                        : `Expires ${new Date(row.expiresAt).toLocaleDateString()}`}
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        <RowActions
                          row={row}
                          onEdit={() => setEditMember(row)}
                          onRemove={() => setRemoveTarget(row)}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {(team.data?.rows ?? []).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={isOwner ? 5 : 4}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No teammates yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InviteDialog
        ownerId={ownerId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["team", ownerId] })}
      />
      <EditMemberDialog
        row={editMember && editMember.kind === "member" ? editMember : null}
        onOpenChange={(o) => !o && setEditMember(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["team", ownerId] })}
      />
      <RemoveDialog
        row={removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["team", ownerId] })}
      />
    </div>
  );
}

function RowActions({
  row,
  onEdit,
  onRemove,
}: {
  row: TeamRow;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const qc = useQueryClient();
  const revokeFn = useServerFn(revokeInvite);
  const resendFn = useServerFn(resendInvite);

  const revoke = useMutation({
    mutationFn: () => revokeFn({ data: { inviteId: row.id } }),
    onSuccess: () => {
      toast.success("Invite revoked");
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e) => toast.error(formatUserError(e)),
  });
  const resend = useMutation({
    mutationFn: () => resendFn({ data: { inviteId: row.id } }),
    onSuccess: (res) => {
      const url = joinUrl(res.token);
      navigator.clipboard
        .writeText(url)
        .then(() =>
          toast.success("New invite link copied — share it with them"),
        )
        .catch(() =>
          toast.success("Invite regenerated — copy the link from the dialog"),
        );
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e) => toast.error(formatUserError(e)),
  });

  // Don't show actions for the owner row
  if (row.kind === "member" && row.role === "owner") return null;
  if (row.kind === "member" && row.isYou) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Row actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {row.kind === "member" ? (
          <>
            <DropdownMenuItem onSelect={onEdit}>
              <Cog className="mr-2 h-4 w-4" /> Edit permissions
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onRemove}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Remove from workspace
            </DropdownMenuItem>
          </>
        ) : (
          <>
            {row.token && (
              <>
                <DropdownMenuItem
                  onSelect={() => {
                    navigator.clipboard
                      .writeText(joinUrl(row.token!))
                      .then(() => toast.success("Invite link copied"))
                      .catch(() =>
                        toast.error(
                          "Could not copy the invite link. Use the resend action to display a new link.",
                        ),
                      );
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy invite link
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    const msg = encodeURIComponent(
                      `You've been invited to join our Vidya Orbit workspace: ${joinUrl(row.token!)}`,
                    );
                    window.open(
                      `https://wa.me/?text=${msg}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                >
                  <MessageCircle className="mr-2 h-4 w-4" /> Share on WhatsApp
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              onSelect={() => resend.mutate()}
              disabled={resend.isPending}
            >
              <Send className="mr-2 h-4 w-4" /> Resend (extend 7 days)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => revoke.mutate()}
              disabled={revoke.isPending}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Revoke invite
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InviteDialog({
  ownerId,
  open,
  onOpenChange,
  onCreated,
}: {
  ownerId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [pick, setPick] = useState<{
    role: Exclude<WorkspaceRole, "owner">;
    permissions: Permissions;
  }>({
    role: "staff",
    permissions: PERMISSION_PRESETS.staff,
  });
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const fn = useServerFn(inviteMember);
  const m = useMutation({
    mutationFn: () =>
      fn({
        data: {
          ownerId,
          email: email.trim().toLowerCase(),
          role: pick.role,
          permissions: pick.permissions,
        },
      }),
    onSuccess: (invite) => {
      const url = joinUrl(invite.token);
      setCreatedLink(url);
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success("Invite created — link copied to clipboard"))
        .catch(() =>
          toast.success("Invite created — copy the link shown below"),
        );
      onCreated();
    },
    onError: (e) => toast.error(formatUserError(e)),
  });

  function reset() {
    setEmail("");
    setPick({ role: "staff", permissions: PERMISSION_PRESETS.staff });
    setCreatedLink(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-md">
        {createdLink ? (
          <>
            <DialogHeader>
              <DialogTitle>Invite ready to share</DialogTitle>
              <DialogDescription>
                Send this link to {email}. It works even if they haven&apos;t
                signed up yet — they&apos;ll land on a page that walks them
                through joining.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border bg-muted/30 p-3 text-xs break-all font-mono">
              {createdLink}
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const msg = encodeURIComponent(
                    `You've been invited to join our Vidya Orbit workspace: ${createdLink}`,
                  );
                  window.open(
                    `https://wa.me/?text=${msg}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const subject = encodeURIComponent(
                    "You've been invited to Vidya Orbit",
                  );
                  const body = encodeURIComponent(
                    `Click to accept your invite:\n\n${createdLink}`,
                  );
                  window.open(
                    `mailto:${email}?subject=${subject}&body=${body}`,
                  );
                }}
              >
                <Mail className="h-4 w-4 mr-2" /> Email
              </Button>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(createdLink);
                  toast.success("Copied again");
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> Copy link
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite a teammate</DialogTitle>
              <DialogDescription>
                We&apos;ll create a one-time link they can use to join — even if
                they don&apos;t have an account yet.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <EmailField value={email} onChange={setEmail} />
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What can they do?
                </div>
                <RolePermissionPicker value={pick} onChange={setPick} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => m.mutate()}
                disabled={m.isPending || !email}
              >
                {m.isPending ? "Creating…" : "Create invite link"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditMemberDialog({
  row,
  onOpenChange,
  onSaved,
}: {
  row: (TeamRow & { kind: "member" }) | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  // Initialize from row each time the dialog opens — fixes the prior bug where
  // opening edit on a second member showed the first member's permissions.
  const [pick, setPick] = useState<{
    role: Exclude<WorkspaceRole, "owner">;
    permissions: Permissions;
  }>({
    role: "staff",
    permissions: PERMISSION_PRESETS.staff,
  });

  useEffect(() => {
    if (row && row.role !== "owner") {
      setPick({
        role: row.role as Exclude<WorkspaceRole, "owner">,
        permissions: row.permissions,
      });
    }
  }, [row]);

  const fn = useServerFn(updateMember);
  const m = useMutation({
    mutationFn: () =>
      fn({
        data: {
          memberId: row!.id,
          role: pick.role,
          permissions: pick.permissions,
        },
      }),
    onSuccess: () => {
      toast.success("Permissions updated");
      onSaved();
      onOpenChange(false);
    },
    onError: (e) => toast.error(formatUserError(e)),
  });

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-md")}>
        <DialogHeader>
          <DialogTitle>Edit permissions</DialogTitle>
          <DialogDescription>{row?.email}</DialogDescription>
        </DialogHeader>
        <RolePermissionPicker value={pick} onChange={setPick} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveDialog({
  row,
  onOpenChange,
  onDone,
}: {
  row: TeamRow | null;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const removeFn = useServerFn(removeMember);
  const m = useMutation({
    mutationFn: () => removeFn({ data: { memberId: row!.id } }),
    onSuccess: () => {
      toast.success("Member removed");
      onDone();
      onOpenChange(false);
    },
    onError: (e) => toast.error(formatUserError(e)),
  });

  const open = !!row && row.kind === "member";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            {row?.email} will lose access immediately. Their past actions
            (payments, attendance, students they added) stay in the workspace.
            You can re-invite them anytime.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              m.mutate();
            }}
            disabled={m.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {m.isPending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
