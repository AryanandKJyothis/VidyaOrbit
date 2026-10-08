import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/billing")({
  beforeLoad: () => {
    throw redirect({ to: "/plan" });
  },
  component: function BillingRedirect() {
    return null;
  },
});
