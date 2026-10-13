import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminAlertsPanel } from "@/components/admin/admin-alerts-panel";
import { EditSubscriptionDialog } from "@/components/admin/edit-subscription-dialog";
import { listAdminAlerts } from "@/lib/admin-platform.functions";

export const Route = createFileRoute("/_authenticated/admin/alerts")({
  ssr: false,
  component: AdminAlertsPage,
});

function AdminAlertsPage() {
  const navigate = useNavigate();
  const [centreId, setCentreId] = useState<string | null>(null);
  const listFn = useServerFn(listAdminAlerts);
  const list = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  return (
    <>
      <AdminAlertsPanel
        alerts={list.data ?? []}
        loading={list.isLoading}
        onOpen={(href, ownerId) => {
          if (href === "/admin/centres" && ownerId) {
            setCentreId(ownerId);
            return;
          }
          if (href === "/admin/users") {
            void navigate({ to: "/admin/users" });
            return;
          }
          if (href === "/admin/payments") {
            void navigate({ to: "/admin/payments" });
          }
        }}
      />
      {centreId && (
        <EditSubscriptionDialog
          ownerId={centreId}
          onClose={() => setCentreId(null)}
          onSaved={() => list.refetch()}
        />
      )}
    </>
  );
}
