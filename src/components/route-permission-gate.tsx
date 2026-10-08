import { Link } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/use-active-workspace";
import type { Permissions } from "@/lib/workspace.functions";

export function RoutePermissionGate({
  resource,
  level = "read",
  children,
}: {
  resource: keyof Permissions;
  level?: "read" | "write";
  children: React.ReactNode;
}) {
  const canAccess = useCan(resource, level);

  if (!canAccess) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Access denied</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              You don't have permission to access this page. Contact your
              workspace administrator if you need access.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
