import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductPreviews } from "@/components/landing/product-previews";
import { Reveal } from "@/components/landing/reveal";
import { PublicPricingGrid } from "@/components/public/pricing-grid";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
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
  HERO_TITLE,
  WHATSAPP_PREFILL,
} from "@/lib/landing-copy";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <section
          id="product"
          className="mx-auto max-w-5xl px-4 pb-10 sm:px-6 sm:pb-16"
        >
          <Reveal>
            <ProductPreviews />
          </Reveal>
        </section>
        <Setup />
        <Pains />
        <Features />
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
            className="h-12 w-full min-h-12 sm:w-auto"
          >
            <MessageCircle className="h-4 w-4" />
            {CTA_WHATSAPP}
          </Button>
        </a>
      )}
      {tel && phone && (
        <a href={tel} className="w-full sm:w-auto">
          <Button
            size="lg"
            variant="outline"
            className={
              onDark
                ? "h-12 w-full min-h-12 border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
                : "h-12 w-full min-h-12 sm:w-auto"
            }
          >
            <Phone className="h-4 w-4" />
            Call {phone}
          </Button>
        </a>
      )}
      <Link
        to="/login"
        search={{ mode: "signup" }}
        className="w-full sm:w-auto"
      >
        <Button
          size="lg"
          variant="ghost"
          className={
            onDark
              ? "h-12 w-full min-h-12 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
              : "h-12 w-full min-h-12 sm:w-auto"
          }
        >
          {CTA_START_FREE}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
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
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pb-16 sm:pt-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full border border-border/80 bg-card/80 px-3 py-1 text-xs font-medium tracking-[0.01em] text-muted-foreground shadow-[var(--shadow-xs)]">
            {HERO_EYEBROW}
          </span>
          <h1 className="font-display mt-5 text-[1.75rem] font-bold leading-[1.08] tracking-[-0.032em] sm:text-5xl md:text-6xl">
            {HERO_TITLE}
          </h1>
          <p
            lang="ml"
            className="mt-3 text-sm leading-[1.75] text-muted-foreground sm:text-base"
          >
            {HERO_MALAYALAM}
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-lg">
            {HERO_SUB}
          </p>
          <HeroCtas />
          <p className="mt-4 text-xs tracking-[0.01em] text-muted-foreground">
            {FOUNDER_LINE}
          </p>
        </div>
      </div>
    </section>
  );
}

function Setup() {
  const steps = [
    {
      n: "1",
      t: "We import your students",
      d: "Upload your Excel or CSV file (.xlsx, .xls or .csv). We map names, batches and fees for you.",
    },
    {
      n: "2",
      t: "We set up batches and fees",
      d: "Timings, due dates and who still owes — ready before you mark the first class.",
    },
    {
      n: "3",
      t: "We add your staff",
      d: "Tutors get a login with the right access. Billing stays with you.",
    },
    {
      n: "4",
      t: "30-minute training",
      d: "Aryanand walks you through attendance, recording a payment, and sending a receipt on WhatsApp.",
    },
  ];
  return (
    <section id="setup" className="border-y border-border/50 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-[-0.022em] sm:text-4xl">
            You teach. We set the software up.
          </h2>
          <p className="mt-3 text-muted-foreground">
            This is the same setup Aryanand does after a sales call — not a
            self-serve maze.
          </p>
        </Reveal>
        <Reveal>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2">
            {steps.map((s) => (
              <li
                key={s.n}
                className="flex gap-4 rounded-2xl border border-border/80 bg-card p-5 shadow-[var(--shadow-card)]"
              >
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

function Pains() {
  const items = [
    {
      pain: "Parents keep asking on WhatsApp who has paid.",
      fix: "Open Fees, tap Overdue, see who still owes this month — then share a numbered receipt the way you already do on WhatsApp.",
    },
    {
      pain: "Attendance lives in a notebook nobody can find.",
      fix: "Pick a batch on your phone, tap present / late / absent, save. A student's last 28 days is on their profile when a parent asks.",
    },
    {
      pain: "Batches, fees and staff are in three different places.",
      fix: "One login for you. Staff get their own login with only the screens they need.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-[-0.022em] sm:text-4xl">
          Built for the centre owner, not a tech team.
        </h2>
        <p className="mt-3 text-muted-foreground">
          If this is your Tuesday, Vidya Orbit is for you.
        </p>
      </Reveal>
      <Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.pain}
              className="rounded-2xl border border-border/80 bg-card p-6 shadow-[var(--shadow-card)]"
            >
              <p className="text-sm font-semibold text-[color:var(--brand-coral)]">
                The problem
              </p>
              <p className="mt-1 text-base font-medium">{it.pain}</p>
              <div className="my-4 h-px bg-border" />
              <p className="text-sm font-semibold text-[color:var(--brand-teal)]">
                In the app
              </p>
              <p className="mt-1 text-base text-muted-foreground">{it.fix}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Features() {
  const features = [
    {
      title: "Who hasn't paid",
      body: "Filter overdue, pending or paid. Record cash, UPI or bank. Export dues if you still like a spreadsheet.",
    },
    {
      title: "Attendance on your phone",
      body: "Mark a whole batch in a few taps. All present, then fix the absentees. Built for a busy evening class.",
    },
    {
      title: "Students and batches",
      body: "Name, parent phone, batch, fee total and due date in one roster. Search instead of scrolling WhatsApp.",
    },
    {
      title: "Numbered receipts",
      body: "Centre name on the receipt. Print or save as PDF from the browser, then send it yourself on WhatsApp.",
    },
    {
      title: "Excel / CSV import",
      body: "Upload .xlsx, .xls or .csv. We do not ask you to paste rows. A template is in the app if you want to tidy the sheet first.",
    },
    {
      title: "Staff logins",
      body: "Invite a tutor with a link. You choose whether they can see fees. Your login stays the owner login.",
    },
  ];
  return (
    <section
      id="features"
      className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20"
    >
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-[-0.022em] sm:text-4xl">
          What you get on day one
        </h2>
        <p className="mt-3 text-muted-foreground">
          Only what the app does today. Charts of collections sit on Starter and
          above.
        </p>
      </Reveal>
      <Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border/80 bg-card p-6 shadow-[var(--shadow-card)]"
            >
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background:
                    "color-mix(in oklab, var(--brand-teal) 18%, transparent)",
                }}
              >
                <Check className="h-5 w-5 text-[color:var(--brand-teal)]" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">
                {f.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="border-t border-border/50 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-[-0.022em] sm:text-4xl">
            Start free. Pay when you grow.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Same prices as the{" "}
            <Link to="/pricing" className="underline underline-offset-2">
              pricing page
            </Link>
            . Paid plans by invoice; online payment is coming soon.
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
  const faqs = [
    {
      q: "Do I have to set this up myself?",
      a: "No. WhatsApp or call Aryanand. We import your Excel or CSV, set up batches and fees, add staff, and train you for 30 minutes.",
    },
    {
      q: "Can I move from Excel?",
      a: "Yes — upload a .xlsx, .xls or .csv file. Pasting cells is not supported. We usually do this with you on the setup call.",
    },
    {
      q: "Do students or parents need to install anything?",
      a: "No. Vidya Orbit is for you and your staff. You still send receipts on WhatsApp yourself. The app does not message parents.",
    },
    {
      q: "Is my data safe?",
      a: "Hosted on Supabase: encrypted in transit and at rest, isolated per institute. You can export students, batches, dues and payments anytime.",
    },
    {
      q: "Can I cancel?",
      a: "Anytime. You stay on the free plan with your data intact. If you are over 25 students, existing data stays usable — adding new students is paused until you upgrade.",
    },
  ];
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h2 className="text-center font-display text-3xl font-bold tracking-[-0.022em] sm:text-4xl">
        Questions owners actually ask
      </h2>
      <div className="mt-10 divide-y divide-border/80 rounded-2xl border border-border/80 bg-card shadow-[var(--shadow-card)]">
        {faqs.map((f) => (
          <details key={f.q} className="group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg font-medium transition-colors duration-100 hover:text-foreground [-webkit-tap-highlight-color:transparent]">
              {f.q}
              <span className="ml-4 text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-45 motion-reduce:transition-none motion-reduce:group-open:rotate-0">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
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
        className="relative overflow-hidden rounded-3xl border border-white/10 p-8 text-center shadow-[var(--shadow-elevated)] sm:p-14"
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
