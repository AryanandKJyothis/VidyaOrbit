import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { OrbitMotif } from "@/components/landing/orbit-motif";
import { Reveal } from "@/components/landing/reveal";
import { TaglineReveal } from "@/components/landing/tagline-reveal";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { SkipToContent } from "@/components/skip-to-content";
import { Logo } from "@/components/logo";
import {
  FOUNDER_NAME,
  FOUNDER_TOWN,
  getContactConfig,
  getWhatsAppHref,
} from "@/lib/contact-config";
import { usePrefers } from "@/hooks/use-prefers";
import { fadeOnly, springDefault } from "@/lib/motion";
import {
  AUDIENCE_LINE,
  CTA_BOOK_DEMO,
  CTA_FINAL,
  CTA_START_FREE,
  FOUNDER_LINE,
  HERO_EYEBROW,
  HERO_MALAYALAM,
  HERO_SUB,
  HERO_TITLE,
  TAGLINE_LINES,
  WHATSAPP_PREFILL,
  WORK_STRIP,
} from "@/lib/landing-copy";
import { SAMPLE_CENTRE, SAMPLE_LABEL } from "@/lib/landing-sample";
import { LANDING_FAQS } from "@/lib/public-faqs";
import { cn } from "@/lib/utils";

const SHELL = "mx-auto w-full max-w-[1280px] px-8 sm:px-16";
const BTN =
  "h-12 !rounded-[4px] px-6 text-base font-semibold transition-transform duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.97]";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SkipToContent />
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <WorkStrip />
        <ProductBand />
        <Audience />
        <Features />
        <OverdueBand />
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

function LandingCtas({
  inverted = false,
  demoFirst = true,
}: {
  inverted?: boolean;
  demoFirst?: boolean;
}) {
  const wa = getWhatsAppHref(WHATSAPP_PREFILL);
  const demoClass = inverted
    ? `${BTN} w-full bg-paper text-ink hover:bg-paper/90 sm:w-auto`
    : `${BTN} w-full bg-orbit-blue text-paper hover:bg-orbit-blue/90 sm:w-auto`;
  const freeClass = inverted
    ? `${BTN} w-full border border-paper/40 bg-transparent text-paper hover:bg-paper/10 sm:w-auto`
    : `${BTN} w-full border border-ink bg-transparent text-ink hover:bg-ink/5 sm:w-auto`;

  const demo = wa ? (
    <a key="demo" href={wa} target="_blank" rel="noreferrer">
      <Button size="lg" className={demoClass}>
        {CTA_BOOK_DEMO}
      </Button>
    </a>
  ) : null;
  const start = (
    <Link key="start" to="/login" search={{ mode: "signup" }}>
      <Button size="lg" variant="outline" className={freeClass}>
        {CTA_START_FREE}
      </Button>
    </Link>
  );

  return (
    <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
      {demoFirst ? (
        <>
          {demo}
          {start}
        </>
      ) : (
        <>
          {start}
          {demo}
        </>
      )}
    </div>
  );
}

function Hero() {
  const { reducedMotion } = usePrefers();
  const lines = HERO_TITLE.replace(/\.$/, "")
    .split(". ")
    .map((line) => `${line}.`);

  return (
    <section className="relative overflow-hidden">
      <OrbitMotif
        spin
        className="pointer-events-none absolute -right-16 top-8 hidden h-[22rem] w-[22rem] opacity-90 lg:block lg:right-4 lg:top-2 lg:h-[30rem] lg:w-[30rem]"
      />
      <div
        className={`${SHELL} relative grid grid-cols-12 gap-6 pb-12 pt-10 sm:pb-16 sm:pt-16`}
      >
        <div className="col-span-12 lg:col-span-8">
          <p className="text-sm font-medium text-slate">{HERO_EYEBROW}</p>
          <h1 className="mt-6 max-w-[16ch] font-display text-5xl font-bold leading-[0.95] tracking-[-0.04em] sm:text-7xl lg:text-8xl">
            {lines.map((line, i) => (
              <motion.span
                key={line}
                className={cn(
                  "block text-balance",
                  i === 1 && "text-orbit-blue",
                )}
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  ...(reducedMotion ? fadeOnly : springDefault),
                  delay: reducedMotion ? 0 : 0.06 + i * 0.09,
                }}
              >
                {line}
              </motion.span>
            ))}
          </h1>
          <p className="mt-6 max-w-[38rem] text-pretty text-lg leading-relaxed text-slate sm:text-xl">
            {HERO_SUB}
          </p>
          <p
            lang="ml"
            className="mt-4 max-w-[38rem] text-pretty text-base leading-relaxed text-slate"
          >
            {HERO_MALAYALAM}
          </p>
          <LandingCtas />
        </div>
      </div>
    </section>
  );
}

function WorkStrip() {
  return (
    <div className="border-y border-ink/20">
      <ul className={`${SHELL} grid grid-cols-2 md:grid-cols-4`}>
        {WORK_STRIP.map((item, i) => (
          <li
            key={item}
            className={cn(
              "py-5 font-display text-lg font-bold tracking-[-0.03em] sm:text-xl",
              i > 0 && "md:border-l md:border-ink/20 md:pl-8",
              i % 2 === 1 && "pl-6 md:pl-8",
            )}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductBand() {
  return (
    <section className="relative overflow-hidden bg-orbit-blue text-paper">
      <OrbitMotif
        inverted
        spin
        className="absolute -left-20 -top-16 h-72 w-72 opacity-30"
      />
      <div
        className={`${SHELL} relative grid items-start gap-10 py-12 sm:py-16 lg:grid-cols-12`}
      >
        <div className="lg:col-span-5 lg:pt-4">
          <p className="text-sm text-paper/70">
            {SAMPLE_CENTRE} · {SAMPLE_LABEL}
          </p>
          <h2 className="mt-4 max-w-[14ch] font-display text-4xl font-bold leading-[0.95] tracking-[-0.04em] text-balance sm:text-5xl">
            Today's batches. Today's dues.
          </h2>
          <p className="mt-4 max-w-sm text-pretty text-base leading-relaxed text-paper/80">
            This is the owner screen. Attendance, fees and batches in one view.
            Sample data. Not a live centre.
          </p>
        </div>
        <div className="lg:col-span-7">
          <div className="overflow-hidden border border-paper/20 bg-paper">
            <img
              src="/landing/preview-dashboard.webp"
              alt="Sample owner dashboard with attendance, fees due and batches"
              width={780}
              height={1058}
              className="screenshot mx-auto block h-auto w-full max-w-2xl"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Audience() {
  const [first, second] = AUDIENCE_LINE.split(". ");
  return (
    <section className="border-b border-ink/20">
      <div className={`${SHELL} py-16 sm:py-20`}>
        <Reveal>
          <p className="max-w-[18ch] font-display text-4xl font-bold leading-[0.95] tracking-[-0.04em] text-balance sm:text-6xl">
            <span className="block">{first}.</span>
            <span className="mt-3 block text-orbit-blue">{second}</span>
          </p>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate">
            Owners. Managers. The staff who mark the register and chase fees.
          </p>
        </Reveal>
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
      title: "Mark attendance by batch.",
      body: "Present, late or absent for the whole class. From your phone.",
    },
    {
      n: "02",
      title: "Track fees as they come in.",
      body: "Record cash or UPI. Numbered receipts with your centre name.",
    },
    {
      n: "03",
      title: "Keep batches in one roster.",
      body: "Name, parent phone, fee total and due date. Staff see only what you allow.",
    },
    {
      n: "04",
      title: "Train the team once.",
      body: "We set the system up. Then a 30 minute walkthrough for you and your staff.",
    },
  ];
  return (
    <section id="features" className="scroll-mt-20">
      <div className={`${SHELL} py-16 sm:py-24`}>
        <SectionLabel n="01" label="The daily work" />
        <div className="mt-10 grid border-b border-ink/20 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.n}
              className="border-t border-ink/20 py-10 pr-8 sm:odd:border-r sm:odd:pr-10 sm:even:pl-10"
            >
              <p className="font-display text-5xl font-bold leading-none tracking-[-0.05em] text-orbit-blue sm:text-6xl">
                {item.n}
              </p>
              <h3 className="mt-6 font-display text-2xl font-bold tracking-[-0.03em] text-balance">
                {item.title}
              </h3>
              <p className="mt-3 max-w-md text-pretty text-base leading-relaxed text-slate">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OverdueBand() {
  return (
    <section className="relative overflow-hidden bg-ink text-paper">
      <OrbitMotif
        inverted
        spin
        className="absolute -right-10 bottom-[-4rem] h-80 w-80 opacity-50"
      />
      <div className={`${SHELL} relative py-16 sm:py-24`}>
        <p className="text-sm text-paper/60">Overdue reminders</p>
        <h2 className="mt-4 max-w-[16ch] font-display text-4xl font-bold leading-[0.95] tracking-[-0.04em] text-balance sm:text-6xl">
          See who still owes before parents ask.
        </h2>
        <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-paper/75">
          Filter overdue fees. We prepare the WhatsApp reminder with the amount
          and your UPI link. You send it. The parent pays your centre.
        </p>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Book a free demo.",
      d: "WhatsApp Aryanand. Tell us how your centre runs today.",
    },
    {
      n: "02",
      t: "We set it up for you.",
      d: "We import your Excel or CSV. Batches, fees and staff logins.",
    },
    {
      n: "03",
      t: "We train your staff.",
      d: "A 30 minute walkthrough. Then you mark attendance and fees.",
    },
  ];
  return (
    <section id="setup" className="scroll-mt-20 border-t border-ink/20">
      <div className={`${SHELL} py-16 sm:py-24`}>
        <SectionLabel n="02" label="Done for you" />
        <ol className="mt-10 grid gap-0 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="border-t border-ink py-8 md:pr-10">
              <p className="font-display text-6xl font-bold leading-none tracking-[-0.05em] text-orbit-blue">
                {s.n}
              </p>
              <h3 className="mt-6 font-display text-xl font-bold tracking-[-0.03em] text-balance">
                {s.t}
              </h3>
              <p className="mt-3 text-pretty text-base leading-relaxed text-slate">
                {s.d}
              </p>
            </li>
          ))}
        </ol>
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
        <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-slate">
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
    <section className="relative overflow-hidden border-t border-ink/20">
      <OrbitMotif className="absolute -right-16 bottom-[-4rem] hidden h-72 w-72 opacity-60 sm:block" />
      <div className={`${SHELL} relative py-16 sm:py-24`}>
        <SectionLabel n="04" label="Kerala" />
        <h2 className="mt-6 max-w-[16ch] font-display text-4xl font-bold tracking-[-0.03em] text-balance sm:text-6xl">
          Built for centres in Kerala.
        </h2>
        <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-slate">
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
              <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-slate">
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
  const { phone } = getContactConfig();
  return (
    <section
      id="final"
      className="relative overflow-hidden bg-orbit-blue text-paper"
    >
      <OrbitMotif
        inverted
        spin
        className="absolute -right-6 top-8 h-72 w-72 sm:right-10 sm:h-96 sm:w-96"
      />
      <div className={`${SHELL} relative py-20 sm:py-28`}>
        <Logo size={56} className="rounded-sm bg-paper p-1" />
        <h2 className="mt-10 max-w-[14ch] font-display text-5xl font-bold leading-[0.95] tracking-[-0.04em] text-balance sm:text-7xl">
          {CTA_FINAL}
        </h2>
        <p className="mt-6 max-w-md text-lg text-paper/75">
          Talk to {FOUNDER_NAME} in {FOUNDER_TOWN}. Book a free demo. Or start
          free and look around.
        </p>
        <LandingCtas inverted />
        {phone && <p className="mt-6 text-sm text-paper/60">{phone}</p>}
      </div>
    </section>
  );
}
