import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductPreviews } from "@/components/landing/product-previews";
import { Reveal } from "@/components/landing/reveal";
import { TaglineReveal } from "@/components/landing/tagline-reveal";
import { PublicPricingGrid } from "@/components/public/pricing-grid";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { SkipToContent } from "@/components/skip-to-content";
import {
  FOUNDER_NAME,
  FOUNDER_TOWN,
  getContactConfig,
  getTelHref,
  getWhatsAppHref,
} from "@/lib/contact-config";
import {
  CTA_START_FREE,
  CTA_WHATSAPP,
  FOUNDER_LINE,
  HERO_EYEBROW,
  HERO_MALAYALAM,
  HERO_SUB,
  WHATSAPP_PREFILL,
} from "@/lib/landing-copy";
import { LANDING_FAQS } from "@/lib/public-faqs";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipToContent />
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <ProofStrip />
        <section
          id="product"
          className="mx-auto max-w-5xl scroll-mt-28 px-4 pb-10 sm:px-6 sm:pb-16"
        >
          <ProductPreviews />
        </section>
        <Benefits />
        <Setup />
        <TaglineReveal
          lines={[
            "We set everything up for you,",
            "zero headache.",
            HERO_MALAYALAM,
          ]}
        />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <SiteFooter />
    </div>
  );
}

function HeroCtas({
  stacked,
  onDark,
}: {
  stacked?: boolean;
  onDark?: boolean;
}) {
  const { phone } = getContactConfig();
  const tel = getTelHref();
  const wa = getWhatsAppHref(WHATSAPP_PREFILL);
  const wrap = stacked
    ? "mt-6 flex w-full max-w-md flex-col gap-2.5"
    : "mt-7 flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center";

  return (
    <div className={wrap}>
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className="w-full sm:w-auto"
        >
          <Button
            size="lg"
            variant={onDark ? "secondary" : "default"}
            className="h-12 w-full min-h-12 text-base font-semibold sm:w-auto"
          >
            <MessageCircle className="h-4 w-4" />
            {CTA_WHATSAPP}
          </Button>
        </a>
      )}
      <div
        className={
          stacked
            ? "flex flex-col gap-2"
            : "flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center"
        }
      >
        {tel && phone && (
          <a
            href={tel}
            className={
              onDark
                ? "inline-flex h-12 min-h-12 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-primary-foreground/85 underline-offset-4 hover:underline"
                : "inline-flex h-12 min-h-12 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            }
          >
            <Phone className="h-4 w-4" />
            Call {phone}
          </a>
        )}
        <Link
          to="/login"
          search={{ mode: "signup" }}
          className={
            onDark
              ? "inline-flex h-12 min-h-12 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-primary-foreground/85 underline-offset-4 hover:underline"
              : "inline-flex h-12 min-h-12 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          }
        >
          {CTA_START_FREE}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 0%, color-mix(in oklab, var(--brand-teal) 18%, transparent), transparent 70%), radial-gradient(45% 40% at 90% 10%, color-mix(in oklab, var(--brand-saffron) 16%, transparent), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 sm:pb-12 sm:pt-10">
        <div className="mx-auto max-w-[680px] text-center">
          <p className="text-xs font-medium tracking-[0.04em] text-muted-foreground">
            {HERO_EYEBROW}
          </p>
          <h1 className="hero-heading-gradient font-display mt-4 text-4xl font-bold leading-none tracking-[-0.03em] sm:text-5xl md:text-6xl">
            We set everything up for you,
            <br className="hidden sm:block" /> zero headache.
          </h1>
          <p
            lang="ml"
            className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base"
          >
            {HERO_MALAYALAM}
          </p>
          <p className="mx-auto mt-4 max-w-[680px] text-base leading-relaxed text-muted-foreground sm:text-lg">
            {HERO_SUB}
          </p>
          <HeroCtas />
        </div>
      </div>
    </section>
  );
}

function ProofStrip() {
  return (
    <section
      aria-label="Founder proof"
      className="mx-auto max-w-3xl px-4 pb-8 text-center sm:px-6"
    >
      <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
        {FOUNDER_LINE}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Free for up to 25 students. Cancel anytime.{" "}
        <Link
          to="/terms"
          hash="refund"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Refunds &amp; cancellations
        </Link>
      </p>
    </section>
  );
}

function Benefits() {
  const items = [
    {
      title: "See who hasn't paid this month",
      body: "Open Fees, filter overdue, record cash or UPI, then share a numbered receipt the way you already do on WhatsApp.",
    },
    {
      title: "Mark a batch on your phone in a few taps",
      body: "Present, late or absent for the whole class. A student's last 28 days sits on their profile when a parent asks.",
    },
    {
      title: "One roster for students, batches and staff",
      body: "Name, parent phone, fee total and due date in one place. Invite tutors with a link and only the screens they need.",
    },
    {
      title: "Import from Excel without pasting cells",
      body: "Upload .xlsx, .xls or .csv. We map names, batches and fees with you on the setup call.",
    },
  ];
  return (
    <section
      id="benefits"
      className="mx-auto max-w-6xl scroll-mt-28 px-4 py-14 sm:px-6 sm:py-20"
    >
      <Reveal className="mx-auto max-w-[680px] text-center">
        <h2 className="font-display text-3xl font-bold tracking-[-0.022em] sm:text-4xl">
          Outcomes for the centre owner, not a tech team
        </h2>
        <p className="mt-3 text-muted-foreground">
          If parents keep asking who paid and attendance lives in a notebook,
          this is for you.
        </p>
      </Reveal>
      <Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {items.map((f) => (
            <div key={f.title} className="flex gap-3">
              <div
                className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background:
                    "color-mix(in oklab, var(--brand-teal) 18%, transparent)",
                }}
              >
                <Check className="h-4 w-4 text-[color:var(--brand-teal)]" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">
                  {f.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Setup() {
  const steps = [
    {
      n: "1",
      t: "We import your students",
      d: "Upload your Excel or CSV file. We map names, batches and fees for you.",
    },
    {
      n: "2",
      t: "We set up batches, fees and staff",
      d: "Timings, due dates, who still owes, and tutor logins with the right access.",
    },
    {
      n: "3",
      t: "30 minute training",
      d: "Aryanand walks you through attendance, recording a payment, and sending a receipt.",
    },
  ];
  return (
    <section
      id="setup"
      className="scroll-mt-28 border-y border-border/50 bg-card/40"
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <Reveal className="mx-auto max-w-[680px] text-center">
          <h2 className="font-display text-3xl font-bold tracking-[-0.022em] sm:text-4xl">
            You teach. We set the software up.
          </h2>
          <p className="mt-3 text-muted-foreground">
            The same setup Aryanand does after a sales call, not a self serve
            maze.
          </p>
        </Reveal>
        <Reveal>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="flex gap-4 md:flex-col md:gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold text-primary-foreground"
                  style={{ background: "var(--primary)" }}
                >
                  {s.n}
                </div>
                <div>
                  <p className="font-semibold">{s.t}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
                </div>
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
    <section
      id="pricing"
      className="scroll-mt-28 border-t border-border/50 bg-card/40"
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[680px] text-center">
          <h2 className="font-display text-3xl font-bold tracking-[-0.022em] sm:text-4xl">
            Start free. Pay when you grow.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Same prices as the{" "}
            <Link to="/pricing" className="underline underline-offset-2">
              pricing page
            </Link>
            . Free plan, no card required. Paid plans by invoice; cancel
            anytime.
          </p>
        </div>
        <div className="mt-12">
          <PublicPricingGrid />
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section
      id="faq"
      className="mx-auto max-w-3xl scroll-mt-28 px-4 py-14 sm:px-6 sm:py-20"
    >
      <h2 className="text-center font-display text-3xl font-bold tracking-[-0.022em] sm:text-4xl">
        Questions owners actually ask
      </h2>
      <div className="mt-10 divide-y divide-border/80 rounded-2xl border border-border/80 bg-card shadow-[var(--shadow-card)]">
        {LANDING_FAQS.map((f) => (
          <details key={f.q} className="group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg font-medium transition-colors duration-150 [transition-timing-function:var(--ease-out)] hover:text-foreground [-webkit-tap-highlight-color:transparent]">
              {f.q}
              <span className="ml-4 text-muted-foreground transition-transform duration-200 [transition-timing-function:var(--ease-out)] group-open:rotate-45 motion-reduce:transition-none motion-reduce:group-open:rotate-0">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 p-8 text-center shadow-[var(--shadow-elevated)] transition-[transform,box-shadow] duration-300 [transition-timing-function:var(--ease-out)] sm:p-14 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[var(--shadow-lift)]"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--primary) 95%, black), color-mix(in oklab, var(--brand-teal) 35%, var(--primary)))",
        }}
      >
        <h2 className="font-display text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
          Talk to {FOUNDER_NAME} in {FOUNDER_TOWN}.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
          Free for up to 25 students if you want to click around first. WhatsApp
          is the fastest way after the call.
        </p>
        <div className="flex justify-center">
          <HeroCtas onDark />
        </div>
      </div>
    </section>
  );
}
