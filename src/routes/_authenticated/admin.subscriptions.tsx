import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  ssr: false,
  component: function AdminSubscriptionsRedirect() {
    return <Navigate to="/admin/centres" replace />;
  },
});
