import { createFileRoute } from "@tanstack/react-router";
import { JsonLd } from "@/components/json-ld";
import { LandingPage } from "@/components/landing/landing-page";
import { PUBLIC_PAGES, homeJsonLd, pageHead } from "@/lib/seo";

const jsonLd = homeJsonLd();

export const Route = createFileRoute("/home")({
  head: () => pageHead(PUBLIC_PAGES.home, jsonLd),
  component: HomeLandingRoute,
});

function HomeLandingRoute() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <LandingPage />
    </>
  );
}
