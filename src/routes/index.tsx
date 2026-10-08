import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { LandingPage } from "@/components/landing/landing-page";
import { jsonLdOffers } from "@/lib/pricing-display";
import { SITE_URL } from "@/lib/site";
import {
  HERO_SUB,
  LANDING_DESCRIPTION,
  LANDING_TITLE,
} from "@/lib/landing-copy";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: LANDING_TITLE },
      { name: "description", content: LANDING_DESCRIPTION },
      { property: "og:title", content: LANDING_TITLE },
      { property: "og:description", content: LANDING_DESCRIPTION },
      { property: "og:url", content: SITE_URL + "/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: LANDING_TITLE },
      { name: "twitter:description", content: LANDING_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Vidya Orbit",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: HERO_SUB,
          offers: jsonLdOffers(SITE_URL + "/"),
          url: SITE_URL,
        }),
      },
    ],
  }),
  component: IndexRoute,
});

function IndexRoute() {
  const { session } = useAuth();
  if (session) return <Navigate to="/dashboard" />;
  return <LandingPage />;
}
