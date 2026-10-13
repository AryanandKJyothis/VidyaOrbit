import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminOverviewPanel } from "@/components/admin/admin-overview-panel";
import { getAdminOverview } from "@/lib/admin-platform.functions";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/")({
  ssr: false,
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const navigate = useNavigate();
  const overviewFn = useServerFn(getAdminOverview);
  const q = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overviewFn(),
    staleTime: 60_000,
  });

  if (q.isLoading || !q.data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    );
  }

  return <AdminOverviewPanel data={q.data} onJump={(to) => navigate({ to })} />;
}
