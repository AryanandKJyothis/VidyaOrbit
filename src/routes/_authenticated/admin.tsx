import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { checkAdmin } from "@/lib/admin-subscriptions.functions";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  component: AdminShell,
});

function AdminShell() {
  const checkAdminFn = useServerFn(checkAdmin);
  const admin = useQuery({
    queryKey: ["admin-check"],
    queryFn: async () => {
      try {
        return await checkAdminFn();
      } catch {
        return { admin: false };
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  if (admin.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-11 w-full rounded-full" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!admin.data?.admin) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div>
      <PageHeader
        title="Admin"
        description="Platform health — centres, people, payments, and anything that needs a look."
      />
      <AdminNav />
      <Outlet />
    </div>
  );
}
