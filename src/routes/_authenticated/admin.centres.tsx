import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminCentresPanel } from "@/components/admin/admin-centres-panel";
import { EditSubscriptionDialog } from "@/components/admin/edit-subscription-dialog";
import { listAdminCentres } from "@/lib/admin-platform.functions";

export const Route = createFileRoute("/_authenticated/admin/centres")({
  ssr: false,
  component: AdminCentresPage,
});

function AdminCentresPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const listFn = useServerFn(listAdminCentres);
  const list = useQuery({
    queryKey: ["admin-centres", search, filter],
    queryFn: () =>
      listFn({
        data: {
          search: search || undefined,
          filter,
          sort: "expiring",
          limit: 50,
        },
      }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  return (
    <>
      <AdminCentresPanel
        rows={list.data?.rows ?? []}
        total={list.data?.total ?? 0}
        search={search}
        filter={filter}
        loading={list.isLoading}
        onSearch={setSearch}
        onFilter={setFilter}
        onOpen={setSelected}
      />
      {selected && (
        <EditSubscriptionDialog
          ownerId={selected}
          onClose={() => setSelected(null)}
          onSaved={() => list.refetch()}
        />
      )}
    </>
  );
}
