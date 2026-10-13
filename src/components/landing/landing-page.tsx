import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { OrbitMotif } from "@/components/landing/orbit-motif";
import { Reveal } from "@/components/landing/reveal";
import { TaglineReveal } from "@/components/landing/tagline-reveal";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { SkipToContent } from "@/components/skip-to-content";
import {
  FOUNDER_NAME,
  FOUNDER_TOWN,
  getContactConfig,
  getWhatsAppHref,
} from "@/lib/contact-config";
import {
  CTA_BOOK_SETUP,
  CTA_START_STARTER,
  CTA_FINAL,
  FOUNDER_LINE,
  HERO_EYEBROW,
  HERO_SUB,
  HERO_TITLE,
  TAGLINE_LINES,
  WHATSAPP_PREFILL,
} from "@/lib/landing-copy";
import { SAMPLE_CENTRE, SAMPLE_LABEL } from "@/lib/landing-sample";
import { LANDING_FAQS } from "@/lib/public-faqs";
import { Logo } from "@/components/logo";

const SHELL = "mx-auto w-full max-w-[1280px] px-8 sm:px-16";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SkipToContent />
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <ProductBand />
        <Features />
        <HowItWorks />
        <TaglineReveal
          lines={[...TAGLINE_LINES]}
          className="border-t border-ink/20 py-24 sm:py-32"
        />
        <Pricing />
        <KeralaNote />
        <FAQ />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function HeroCtas({
  inverted = false,
  primaryLabel = CTA_START_STARTER,
}: {
  inverted?: boolean;
  primaryLabel?: string;
}) {
  const wa = getWhatsAppHref(WHATSAPP_PREFILL);
  return (
    <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
      <Link to="/login" search={{ mode: "signup" }}>
        <Button
          size="lg"
          className={
            inverted
              ? "h-12 w-full !rounded-[4px] bg-paper px-6 text-base font-semibold text-ink hover:bg-paper/90 sm:w-auto"
              : "h-12 w-full !rounded-[4px] bg-orbit-blue px-6 text-base font-semibold text-paper hover:bg-orbit-blue/90 sm:w-auto"
          }
        >
          {primaryLabel}
        </Button>
      </Link>
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer">
          <Button
            size="lg"
            variant="outline"
            className={
              inverted
                ? "h-12 w-full !rounded-[4px] border-paper/40 bg-transparent px-6 text-base font-semibold text-paper hover:bg-paper/10 sm:w-auto"
                : "h-12 w-full !rounded-[4px] border-ink bg-transparent px-6 text-base font-semibold text-ink hover:bg-ink/5 sm:w-auto"
            }
          >
            {CTA_BOOK_SETUP}
          </Button>
        </a>
      )}
    </div>
  );
}

function Hero() {
  const lines = HERO_TITLE.replace(/\.$/, "").split(" for ");
  return (
    <section className="relative overflow-hidden">
      <OrbitMotif className="absolute -right-8 top-16 h-64 w-64 opacity-90 sm:right-12 sm:h-80 sm:w-80" />
      <div
        className={`${SHELL} grid grid-cols-12 gap-6 pb-12 pt-10 sm:pb-16 sm:pt-16`}
      >
        <div className="col-span-12 lg:col-span-8">
          <p className="text-sm font-medium text-slate">{HERO_EYEBROW}</p>
          <h1 className="mt-6 max-w-[18ch] text-balance font-display text-5xl font-bold leading-[0.95] tracking-[-0.04em] sm:text-7xl lg:text-8xl">
            {lines[0]}
            {lines[1] ? (
              <>
                <br />
                for {lines[1]}.
              </>
            ) : (
              "."
            )}
          </h1>
          <p className="mt-6 max-w-[42rem] text-pretty text-lg leading-relaxed text-slate sm:text-xl">
            {HERO_SUB}
          </p>
          <HeroCtas />
        </div>
      </div>
    </section>
  );
}

function ProductBand() {
  return (
    <section className="bg-orbit-blue text-paper" aria-label="Product preview">
      <div className={`${SHELL} py-10 sm:py-14`}>
        <p className="text-sm tracking-[0.14em] text-paper/70">
          {SAMPLE_CENTRE} · {SAMPLE_LABEL}
        </p>
        <div className="mt-6 overflow-hidden border border-paper/20 bg-paper">
          <img
            src="/landing/preview-dashboard.webp"
            alt="Sample dashboard with today's attendance, fees due and batches"
            width={780}
            height={1058}
            className="screenshot mx-auto block h-auto w-full max-w-3xl"
            loading="eager"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}

function SectionLabel({ n, label }: { n: string; label: string }) {
  return (
    <p className="text-sm text-slate">
      {n} — {label}
    </p>
  );
}

function Features() {
  const items = [
    {
      n: "01",
      title: "Track attendance by batch.",
      body: "Present, late or absent for the whole class, from your phone.",
    },
    {
      n: "02",
      title: "Track fees clearly.",
      body: "See who still owes, record cash or UPI, then share a numbered receipt.",
    },
    {
      n: "03",
      title: "Keep student records together.",
      body: "Name, parent phone, fee total and due date in one roster.",
    },
    {
      n: "04",
      title: "Send reminders to parents.",
      body: "We prepare the WhatsApp message with the amount and your UPI link. You send it.",
    },
  ];
  return (
    <section id="features" className="scroll-mt-20 border-t border-ink/20">
      <div className={`${SHELL} py-16 sm:py-24`}>
        <SectionLabel n="01" label="Features" />
        <Reveal>
          <div className="mt-10 grid sm:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.n}
                className="border-t border-ink/20 py-8 pr-8 sm:odd:border-r sm:odd:pr-10 sm:even:pl-10"
              >
                <p className="font-display text-sm font-bold text-orbit-blue">
                  {item.n}
                </p>
                <h3 className="mt-3 font-display text-2xl font-bold tracking-[-0.03em] text-balance">
                  {item.title}
                </h3>
                <p className="mt-3 max-w-md text-base leading-relaxed text-slate text-pretty">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Tell us about your centre.",
      d: "WhatsApp or call. Send the Excel or CSV you already use.",
    },
    {
      n: "02",
      t: "We set up the system for your team.",
      d: "We import students, batches, fees and staff logins.",
    },
    {
      n: "03",
      t: "Start marking attendance and fees.",
      d: "A 30 minute walkthrough, then you run the day from your phone.",
    },
  ];
  return (
    <section id="setup" className="scroll-mt-20 border-t border-ink/20">
      <div className={`${SHELL} py-16 sm:py-24`}>
        <SectionLabel n="02" label="How it works" />
        <Reveal>
          <ol className="mt-10 grid gap-0 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="border-t border-ink py-8 md:pr-10">
                <p className="font-display text-6xl font-bold leading-none tracking-[-0.05em] text-orbit-blue">
                  {s.n}
                </p>
                <h3 className="mt-6 font-display text-xl font-bold tracking-[-0.03em] text-balance">
                  {s.t}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-slate text-pretty">
                  {s.d}
                </p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 border-t border-ink/20">
      <div className={`${SHELL} py-16 sm:py-24`}>
        <SectionLabel n="03" label="Pricing" />
        <h2 className="mt-6 max-w-[18ch] font-display text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">
          One price per plan. Monthly or annual.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate text-pretty">
          Starter, Growth and Large. ₹5,000 setup on monthly Growth and Large
          only, waived on annual. Same figures as the pricing page.
        </p>
        <div className="mt-12">
          <LandingPricing />
        </div>
      </div>
    </section>
  );
}

function KeralaNote() {
  return (
    <section className="border-t border-ink/20">
      <div className={`${SHELL} py-16 sm:py-24`}>
        <SectionLabel n="04" label="Kerala" />
        <h2 className="mt-6 max-w-[16ch] font-display text-4xl font-bold tracking-[-0.03em] text-balance sm:text-6xl">
          Built for centres in Kerala.
        </h2>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate text-pretty">
          {FOUNDER_LINE}
        </p>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-ink/20">
      <div className={`${SHELL} grid gap-10 py-16 sm:py-24 lg:grid-cols-12`}>
        <div className="lg:col-span-4">
          <SectionLabel n="05" label="FAQ" />
          <h2 className="mt-6 font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
            Questions
          </h2>
        </div>
        <div className="lg:col-span-8">
          {LANDING_FAQS.map((f) => (
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
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate text-pretty">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const wa = getWhatsAppHref(WHATSAPP_PREFILL);
  const { phone } = getContactConfig();
  return (
    <section
      id="final"
      className="relative overflow-hidden bg-orbit-blue text-paper"
    >
      <OrbitMotif
        inverted
        className="absolute -right-6 top-8 h-72 w-72 sm:right-10"
      />
      <div className={`${SHELL} relative py-20 sm:py-28`}>
        <Logo size={56} className="rounded-sm bg-paper p-1" />
        <h2 className="mt-10 max-w-[14ch] font-display text-5xl font-bold leading-[0.95] tracking-[-0.04em] text-balance sm:text-7xl">
          {CTA_FINAL}
        </h2>
        <p className="mt-6 max-w-md text-lg text-paper/75">
          Talk to {FOUNDER_NAME} in {FOUNDER_TOWN}.
        </p>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="mt-10 inline-block"
          >
            <Button
              size="lg"
              className="h-12 !rounded-[4px] bg-paper px-6 text-base font-semibold text-ink hover:bg-paper/90"
            >
              {CTA_BOOK_SETUP}
            </Button>
          </a>
        )}
        {phone && <p className="mt-6 text-sm text-paper/60">{phone}</p>}
      </div>
    </section>
  );
}
