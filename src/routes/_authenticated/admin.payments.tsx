import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminPaymentsPanel } from "@/components/admin/admin-payments-panel";
import { EditSubscriptionDialog } from "@/components/admin/edit-subscription-dialog";
import { listAdminPayments } from "@/lib/admin-platform.functions";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  ssr: false,
  component: AdminPaymentsPage,
});

function AdminPaymentsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [centreId, setCentreId] = useState<string | null>(null);
  const listFn = useServerFn(listAdminPayments);
  const list = useQuery({
    queryKey: ["admin-payments", search, filter],
    queryFn: () =>
      listFn({
        data: { search: search || undefined, filter, limit: 50 },
      }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  return (
    <>
      <AdminPaymentsPanel
        rows={list.data?.rows ?? []}
        total={list.data?.total ?? 0}
        search={search}
        filter={filter}
        loading={list.isLoading}
        onSearch={setSearch}
        onFilter={setFilter}
        onOpenCentre={setCentreId}
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
