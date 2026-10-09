import { createFileRoute } from "@tanstack/react-router";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { getContactConfig } from "@/lib/contact-config";
import { PRICING_FAQS } from "@/lib/public-faqs";
import { PUBLIC_PAGES, pageHead, pricingJsonLd } from "@/lib/seo";
import { ShieldCheck, MessageCircle, Mail } from "lucide-react";
import { PublicPricingGrid } from "@/components/public/pricing-grid";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";

const jsonLd = pricingJsonLd();

export const Route = createFileRoute("/pricing")({
  head: () => pageHead(PUBLIC_PAGES.pricing, jsonLd),
  component: PricingPage,
});

function ContactCard() {
  const { whatsappUrl, email } = getContactConfig();
  if (!whatsappUrl && !email) return null;

  return (
    <div className="mt-10 rounded-2xl border border-border/80 bg-card p-6 text-center shadow-[var(--shadow-card)]">
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
      <JsonLd data={jsonLd} />
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
              <h1 className="font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
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
            <h2 className="font-display text-center text-3xl font-bold tracking-[-0.022em]">
              Frequently asked
            </h2>
            <div className="mt-8 space-y-3">
              {PRICING_FAQS.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-2xl border border-border/80 bg-card p-5 shadow-[var(--shadow-xs)]"
                >
                  <summary className="cursor-pointer list-none text-sm font-semibold text-foreground [-webkit-tap-highlight-color:transparent]">
                    <span className="mr-2 inline-block transition-transform duration-200 ease-out group-open:rotate-90 motion-reduce:transition-none motion-reduce:group-open:rotate-0">
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
