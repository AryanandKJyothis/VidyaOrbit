import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { getContactConfig, getWhatsAppHref } from "@/lib/contact-config";
import { PRICING_FAQS } from "@/lib/public-faqs";
import {
  APPROVED_PRICING,
  CUSTOM_QUOTE_LINE,
  WHATSAPP_COMING_SOON_LINE,
  dfySetupLine,
} from "@/lib/pricing-display";
import { landingSignupCta } from "@/lib/landing-copy";
import { useAuth } from "@/hooks/use-auth";
import { PUBLIC_PAGES, pageHead, pricingJsonLd } from "@/lib/seo";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { SkipToContent } from "@/components/skip-to-content";

const jsonLd = pricingJsonLd();

const SHELL = "mx-auto w-full max-w-[1280px] px-8 sm:px-16";
const BTN = "h-11 !rounded-[4px] px-6 text-sm font-semibold";
const FREE_PLAN = APPROVED_PRICING.find((p) => p.code === "free")!;

export const Route = createFileRoute("/pricing")({
  head: () => pageHead(PUBLIC_PAGES.pricing, jsonLd),
  component: PricingPage,
});

function SectionLabel({ n, label }: { n: string; label: string }) {
  return (
    <p className="text-sm text-slate">
      {n} — {label}
    </p>
  );
}

function FreeAndCustom() {
  const { email } = getContactConfig();
  const quoteMsg =
    "Hi, I'd like a custom quote for my institute (over 800 students or more than one branch).";
  const wa = getWhatsAppHref(quoteMsg);
  const { session } = useAuth();
  const signup = landingSignupCta(Boolean(session));

  return (
    <div className="mt-12 grid border-t border-ink/20 md:grid-cols-2">
      <article className="flex flex-col border-ink/20 px-6 py-8 md:border-r">
        <h3 className="font-display text-xl font-bold tracking-[-0.03em]">
          {FREE_PLAN.displayName}
        </h3>
        <p className="mt-1 text-sm text-slate">{FREE_PLAN.studentLimit}</p>
        <p className="mt-6 font-display text-5xl font-bold leading-none tracking-[-0.04em]">
          ₹0
        </p>
        <ul className="mt-6 flex-1 space-y-2 text-sm">
          {FREE_PLAN.features
            .filter((f) => f !== FREE_PLAN.studentLimit)
            .map((f) => (
              <li key={f} className="border-t border-ink/15 py-2">
                {f}
              </li>
            ))}
        </ul>
        <Link
          to={signup.to}
          search={"search" in signup ? signup.search : undefined}
          className="mt-8"
        >
          <Button
            variant="outline"
            className={`${BTN} w-full border-ink/30 bg-transparent text-ink`}
          >
            {signup.label}
          </Button>
        </Link>
      </article>
      <article className="flex flex-col border-t border-ink/20 px-6 py-8 md:border-t-0">
        <h3 className="font-display text-xl font-bold tracking-[-0.03em]">
          Custom quote
        </h3>
        <p className="mt-1 text-sm text-slate">
          800+ students or more than one branch
        </p>
        <p className="mt-6 font-display text-3xl font-bold leading-tight tracking-[-0.03em]">
          Priced for your institute
        </p>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-slate">
          {CUSTOM_QUOTE_LINE} Tell us your student count and branches and we
          will send a quote.
        </p>
        {(wa || email) && (
          <a
            href={
              wa ??
              `mailto:${email}?subject=${encodeURIComponent("Custom quote")}&body=${encodeURIComponent(quoteMsg)}`
            }
            target={wa ? "_blank" : undefined}
            rel="noreferrer"
            className="mt-8"
          >
            <Button
              className={`${BTN} w-full bg-orbit-blue text-paper hover:bg-orbit-blue/90`}
            >
              Ask for a quote
            </Button>
          </a>
        )}
      </article>
    </div>
  );
}

function ContactBlock() {
  const { whatsappUrl, email } = getContactConfig();
  if (!whatsappUrl && !email) return null;

  return (
    <div className="mt-12 border-t border-ink/20 pt-8">
      <h3 className="font-display text-2xl font-bold tracking-[-0.03em]">
        Still have questions?
      </h3>
      <p className="mt-2 text-base text-slate">
        Message us and we'll help you pick a plan.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noreferrer">
            <Button
              className={`${BTN} w-full bg-orbit-blue text-paper hover:bg-orbit-blue/90 sm:w-auto`}
            >
              WhatsApp us
            </Button>
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="min-w-0">
            <Button
              variant="outline"
              className={`${BTN} w-full max-w-full truncate border-ink/30 bg-transparent text-ink sm:w-auto`}
            >
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
    <div className="min-h-screen overflow-x-clip bg-paper text-ink">
      <JsonLd data={jsonLd} />
      <SkipToContent />
      <SiteHeader nav="pricing" />

      <main id="main-content">
        <section className="border-b border-ink/20">
          <div className={`${SHELL} py-16 sm:py-24`}>
            <SectionLabel n="01" label="Pricing" />
            <h1 className="mt-6 max-w-[18ch] font-display text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">
              One price per plan. Monthly or annual.
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-slate">
              Free up to 25 students. Spark, Orbit, Centre and Campus are paid
              monthly or yearly, and yearly gets you 2 months free.{" "}
              {dfySetupLine()}
            </p>
            <div className="mt-12">
              <LandingPricing showFullPlanLink={false} />
            </div>
            <FreeAndCustom />
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate">
              <span>Data encrypted in transit and at rest</span>
              <span>Multi-level permissions</span>
              <span>Export data anytime</span>
              <span>{WHATSAPP_COMING_SOON_LINE}</span>
            </div>
            <p className="mt-4 text-sm text-slate">
              <Link
                to="/refund-policy"
                className="text-ink underline underline-offset-4"
              >
                Refunds &amp; cancellations
              </Link>
            </p>
          </div>
        </section>

        <section>
          <div
            className={`${SHELL} grid gap-10 py-16 sm:py-24 lg:grid-cols-12`}
          >
            <div className="lg:col-span-4">
              <SectionLabel n="02" label="FAQ" />
              <h2 className="mt-6 font-display text-4xl font-bold tracking-[-0.03em]">
                Pricing questions
              </h2>
            </div>
            <div className="lg:col-span-8">
              {PRICING_FAQS.map((f) => (
                <details
                  key={f.q}
                  className="group border-t border-ink/20 py-5 last:border-b"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 font-display text-lg font-bold tracking-[-0.02em] [-webkit-tap-highlight-color:transparent]">
                    {f.q}
                    <span className="mt-0.5 text-slate transition-transform duration-200 [transition-timing-function:var(--ease-out)] group-open:rotate-45 motion-reduce:transition-none">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-slate">
                    {f.a}
                  </p>
                </details>
              ))}
              <ContactBlock />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
