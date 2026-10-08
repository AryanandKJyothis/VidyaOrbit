import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { jsonLdOffers } from "@/lib/pricing-display";
import { getContactConfig } from "@/lib/contact-config";
import { SITE_URL } from "@/lib/site";
import { ShieldCheck, MessageCircle, Mail } from "lucide-react";
import { PublicPricingGrid } from "@/components/public/pricing-grid";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";

const TITLE = "Pricing — Vidya Orbit";
const DESC =
  "Simple INR pricing for Indian coaching centres. Start free for up to 25 students. Upgrade only when you grow.";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: SITE_URL + "/pricing" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/pricing" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Vidya Orbit",
          description: DESC,
          offers: jsonLdOffers(SITE_URL + "/pricing"),
        }),
      },
    ],
  }),
  component: PricingPage,
});

const FAQ = [
  {
    q: "Can I really start free?",
    a: "Yes. The Free plan supports up to 25 students with no credit card required. Use it as long as you like.",
  },
  {
    q: "What happens if I cross my student limit?",
    a: "Existing data stays safe and usable. Adding new students is paused until you upgrade.",
  },
  {
    q: "How do I upgrade?",
    a: "Contact us and we'll help you upgrade to a paid plan that fits your needs. Online payment is coming soon.",
  },
  {
    q: "Can I cancel or downgrade?",
    a: "Yes. Contact us and we'll help you adjust your plan the same day.",
  },
  {
    q: "Is my data safe?",
    a: "Yes. Data is encrypted in transit and at rest, isolated per institute, and only your authorised team can access it. We never sell or share institute data.",
  },
];

function ContactCard() {
  const { whatsappUrl, email } = getContactConfig();
  if (!whatsappUrl && !email) return null;

  return (
    <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-center">
      <h3 className="font-display text-xl font-semibold">
        Still have questions?
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Reach out and we'll help you find the right plan.
      </p>
      <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <MessageCircle className="mr-1.5 h-4 w-4" />
              WhatsApp us
            </Button>
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`}>
            <Button variant="ghost" size="sm">
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              {email}
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader nav="pricing" />

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(50% 40% at 20% 0%, color-mix(in oklab, var(--brand-teal) 18%, transparent), transparent 70%), radial-gradient(40% 35% at 90% 10%, color-mix(in oklab, var(--brand-saffron) 18%, transparent), transparent 70%)",
            }}
          />
          <div className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
                Simple, INR-first pricing
              </h1>
              <p className="mt-4 text-muted-foreground sm:text-lg">
                Start free. Upgrade only when your centre grows. Paid plans are
                arranged by invoice; online payment is coming soon.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <PublicPricingGrid />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Paid plans are arranged by invoice (monthly or annual). Online
            payment is coming soon.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--brand-teal)]" />
              Data encrypted in transit and at rest
            </span>
            <span>Multi-level permissions</span>
            <span>Export data anytime</span>
          </div>
        </section>

        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
            <h2 className="font-display text-center text-3xl font-bold tracking-tight">
              Frequently asked
            </h2>
            <div className="mt-8 space-y-4">
              {FAQ.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-border bg-card p-5 open:shadow-sm"
                >
                  <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                    <span className="mr-2 inline-block transition group-open:rotate-90">
                      ›
                    </span>
                    {f.q}
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>

            <ContactCard />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
