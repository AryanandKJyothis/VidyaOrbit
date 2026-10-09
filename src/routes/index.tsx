import { createFileRoute, Navigate } from "@tanstack/react-router";
import { JsonLd } from "@/components/json-ld";
import { LandingPage } from "@/components/landing/landing-page";
import { useAuth } from "@/hooks/use-auth";
import { PUBLIC_PAGES, homeJsonLd, pageHead } from "@/lib/seo";

const jsonLd = homeJsonLd();

export const Route = createFileRoute("/")({
  head: () => pageHead(PUBLIC_PAGES.home, jsonLd),
  component: IndexRoute,
});

function IndexRoute() {
  const { session } = useAuth();
  if (session) return <Navigate to="/dashboard" />;
  return (
    <>
      <JsonLd data={jsonLd} />
      <LandingPage />
    </>
  );
}
