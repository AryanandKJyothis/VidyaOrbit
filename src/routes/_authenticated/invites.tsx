import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Mail } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import {
  listMyPendingInvites,
  acceptInvite,
  declineInvite,
} from "@/lib/workspace.functions";
import { formatUserError } from "@/lib/format-error";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/_authenticated/invites")({
  validateSearch: (s) => searchSchema.parse(s),
  component: InvitesPage,
});

function InvitesPage() {
  const search = useSearch({ from: "/_authenticated/invites" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ws = useActiveWorkspace();

  const fetchInvites = useServerFn(listMyPendingInvites);
  const acceptFn = useServerFn(acceptInvite);
  const declineFn = useServerFn(declineInvite);

  const invites = useQuery({
    queryKey: ["my-invites"],
    queryFn: () => fetchInvites(),
  });

  const accept = useMutation({
    mutationFn: (token: string) => acceptFn({ data: { token } }),
    onSuccess: (res) => {
      toast.success("You&apos;re now in the workspace");
      qc.invalidateQueries({ queryKey: ["my-invites"] });
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      ws.refresh();
      ws.setActiveOwnerId(res.ownerId);
      navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error(formatUserError(e)),
  });
  const decline = useMutation({
    mutationFn: (token: string) => declineFn({ data: { token } }),
    onSuccess: () => {
      toast.success("Invite declined");
      qc.invalidateQueries({ queryKey: ["my-invites"] });
    },
    onError: (e) => toast.error(formatUserError(e)),
  });

  // Auto-handle ?token=... by matching to a listed invite (no auto-accept)
  useEffect(() => {
    if (!search.token || !invites.data) return;
    const match = invites.data.find((i) => i.token === search.token);
    if (!match) return;
    // Scroll-into-view hint already visible via list
  }, [search.token, invites.data]);

  return (
    <div className="space-y-6">
      <PageHeader title="Invites" description="Workspaces you&apos;ve been invited to join." />

      {invites.isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : (invites.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Mail className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No pending invites.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {invites.data!.map((i) => (
            <Card key={i.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{i.workspaceName}</CardTitle>
                <CardDescription>
                  <Badge variant="secondary" className="mr-2">{i.role}</Badge>
                  Expires {new Date(i.expires_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button
                  onClick={() => accept.mutate(i.token)}
                  disabled={accept.isPending}
                  size="sm"
                >
                  <Check className="h-4 w-4 mr-1.5" /> Accept
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => decline.mutate(i.token)}
                  disabled={decline.isPending}
                  size="sm"
                >
                  <X className="h-4 w-4 mr-1.5" /> Decline
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
