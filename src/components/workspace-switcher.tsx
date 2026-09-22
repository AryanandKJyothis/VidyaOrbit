import { useState } from "react";
import { Check, ChevronsUpDown, Building2, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { useActiveWorkspace, type Workspace } from "@/hooks/use-active-workspace";
import { leaveWorkspace } from "@/lib/workspace.functions";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher() {
  const { workspaces, active, setActiveOwnerId, refresh } = useActiveWorkspace();
  const [toRemove, setToRemove] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const leaveFn = useServerFn(leaveWorkspace);
  const qc = useQueryClient();

  if (!active) return null;

  async function confirmLeave() {
    if (!toRemove) return;
    setBusy(true);
    try {
      await leaveFn({ data: { ownerId: toRemove.ownerId } });
      toast.success(`Removed ${toRemove.name} from your list`);
      // If we just left the active workspace, switch to another one.
      if (active && toRemove.ownerId === active.ownerId) {
        const next = workspaces.find((w) => w.ownerId !== toRemove.ownerId);
        if (next) setActiveOwnerId(next.ownerId);
      }
      setToRemove(null);
      refresh();
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove workspace");
    } finally {
      setBusy(false);
    }
  }

  const trigger =
    workspaces.length <= 1 ? (
      <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-foreground">
        <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="truncate font-medium">{active.name}</span>
      </div>
    ) : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-2 h-9">
            <span className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate text-sm font-medium">{active.name}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.map((w) => (
            <DropdownMenuItem
              key={w.ownerId}
              onSelect={(e) => {
                e.preventDefault();
                setActiveOwnerId(w.ownerId);
              }}
              className="flex items-center justify-between gap-2"
            >
              <button
                type="button"
                onClick={() => setActiveOwnerId(w.ownerId)}
                className="flex flex-1 items-center gap-2 min-w-0 text-left"
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    w.ownerId === active.ownerId ? "opacity-100" : "opacity-0",
                  )}
                />
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-sm">{w.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {w.isOwn ? "Owner" : w.role}
                  </span>
                </div>
              </button>
              {!w.isOwn && (
                <button
                  type="button"
                  aria-label={`Remove ${w.name} from your list`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setToRemove(w);
                  }}
                  className="rounded p-1 text-muted-foreground opacity-70 transition hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );

  return (
    <>
      {trigger}
      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this workspace from your list?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll lose access to <span className="font-medium text-foreground">{toRemove?.name}</span>
              {" "}and it will disappear from your switcher. No data is deleted — the owner can invite you back anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void confirmLeave();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
