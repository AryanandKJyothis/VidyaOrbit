import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import { AdminUserDetailDialog } from "@/components/admin/admin-user-detail-dialog";
import { EditSubscriptionDialog } from "@/components/admin/edit-subscription-dialog";
import { listAdminUsers } from "@/lib/admin-platform.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  ssr: false,
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [centreId, setCentreId] = useState<string | null>(null);
  const listFn = useServerFn(listAdminUsers);
  const list = useQuery({
    queryKey: ["admin-users", search, filter],
    queryFn: () =>
      listFn({
        data: { search: search || undefined, filter, limit: 50 },
      }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  return (
    <>
      <AdminUsersPanel
        rows={list.data?.rows ?? []}
        total={list.data?.total ?? 0}
        search={search}
        filter={filter}
        loading={list.isLoading}
        onSearch={setSearch}
        onFilter={setFilter}
        onOpen={setUserId}
      />
      {userId && (
        <AdminUserDetailDialog
          userId={userId}
          onClose={() => setUserId(null)}
          onOpenCentre={(id) => {
            setUserId(null);
            setCentreId(id);
          }}
        />
      )}
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
