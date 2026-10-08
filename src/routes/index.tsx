import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { LogoWordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  Users,
  CalendarCheck,
  Wallet,
  Receipt,
  LineChart,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Check,
  MessageCircle,
  Zap,
  HeartHandshake,
  Mail,
} from "lucide-react";
import {
  APPROVED_PRICING,
  formatIndianPrice,
  getAnnualSavingsLabel,
  jsonLdOffers,
} from "@/lib/pricing-display";
import { getContactConfig } from "@/lib/contact-config";

const SITE_URL = "https://vidyaorbit.in";
const HERO_TITLE = "Run your coaching centre — without the spreadsheet chaos.";
const HERO_SUB =
  "Vidya Orbit gives Indian coaching centres and tuition institutes one calm place to manage students, batches, attendance, fees and receipts. Built for owners who'd rather teach than chase WhatsApp messages.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vidya Orbit — Coaching centre management, made calm" },
      {
        name: "description",
        content:
          "One simple dashboard for Indian coaching centres: students, batches, attendance, fee receipts and analytics. Replace your spreadsheets in a single afternoon.",
      },
      {
        property: "og:title",
        content: "Vidya Orbit — Coaching centre management, made calm",
      },
      {
        property: "og:description",
        content:
          "Students, batches, attendance, fees and receipts in one calm dashboard built for Indian coaching centres.",
      },
      { property: "og:url", content: SITE_URL + "/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  return <Landing />;
}

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <TrustStrip />
        <Pains />
        <FeatureGrid />
        <WorkflowStrip />
        <ProofStrip />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="Vidya Orbit home">
          <LogoWordmark size={30} />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground transition">
            Features
          </a>
          <Link to="/pricing" className="hover:text-foreground transition">
            Pricing
          </Link>
          <a href="#faq" className="hover:text-foreground transition">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
              Sign in
            </Button>
          </Link>
          <Link to="/login" search={{ mode: "signup" }}>
            <Button size="sm" className="shadow-sm">
              Start free
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* orbital glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 0%, color-mix(in oklab, var(--brand-teal) 22%, transparent), transparent 70%), radial-gradient(45% 40% at 90% 10%, color-mix(in oklab, var(--brand-saffron) 22%, transparent), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 md:pb-24 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--brand-teal)]" />
            Built for Indian coaching centres
          </span>
          <h1 className="font-display mt-5 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            {HERO_TITLE}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {HERO_SUB}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/login" search={{ mode: "signup" }}>
              <Button size="lg" className="w-full sm:w-auto">
                Start free — no card needed
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                View pricing
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free for up to 25 students · Contact us to upgrade · Cancel anytime
          </p>
        </div>

        {/* Product preview card */}
        <div className="mx-auto mt-14 max-w-5xl">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <div className="relative rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-lift)] sm:p-4">
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-coral)]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-saffron)]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-teal)]/70" />
          <span className="ml-3 text-[11px] font-medium text-muted-foreground">
            vidyaorbit.in/dashboard
          </span>
          <span className="ml-auto rounded bg-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
            Sample data
          </span>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-6">
          <PreviewStat
            label="Active students"
            value="184"
            trend="+12 this week"
            tone="teal"
          />
          <PreviewStat
            label="Collected this month"
            value="₹2,48,500"
            trend="+18% vs last"
            tone="saffron"
          />
          <PreviewStat
            label="Attendance today"
            value="92%"
            trend="156 / 170 present"
            tone="coral"
          />

          <div className="sm:col-span-2 rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Fees overdue</h3>
              <span className="text-xs text-muted-foreground">7 students</span>
            </div>
            <ul className="space-y-2.5 text-sm">
              {[
                ["Aarav Sharma", "₹3,200", "5 days"],
                ["Priya Menon", "₹2,800", "3 days"],
                ["Rohan Iyer", "₹4,500", "1 day"],
              ].map(([n, a, d]) => (
                <li
                  key={n}
                  className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
                >
                  <span className="font-medium">{n}</span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <span>{a}</span>
                    <span className="rounded-full bg-[color:var(--brand-coral)]/15 px-2 py-0.5 text-[11px] font-medium text-[color:var(--brand-coral)]">
                      {d} late
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold">This week</h3>
            <div className="flex h-28 items-end gap-2">
              {[40, 65, 50, 80, 72, 90, 58].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-[color:var(--brand-teal)]/30 to-[color:var(--brand-teal)]"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Attendance trend
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewStat({
  label,
  value,
  trend,
  tone,
}: {
  label: string;
  value: string;
  trend: string;
  tone: "teal" | "saffron" | "coral";
}) {
  const color =
    tone === "teal"
      ? "var(--brand-teal)"
      : tone === "saffron"
        ? "var(--brand-saffron)"
        : "var(--brand-coral)";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight">
        {value}
      </p>
      <p
        className="mt-1 text-xs font-medium"
        style={{ color: `color-mix(in oklab, ${color} 85%, black)` }}
      >
        {trend}
      </p>
    </div>
  );
}

function TrustStrip() {
  return (
    <section className="border-y border-border/60 bg-card/40">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-6 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
        <span>Contact us for billing</span>
        <span className="opacity-50">·</span>
        <span>WhatsApp-friendly</span>
        <span className="opacity-50">·</span>
        <span>Data encrypted</span>
        <span className="opacity-50">·</span>
        <span>Made in India</span>
      </div>
    </section>
  );
}

function Pains() {
  const items = [
    {
      pain: "Attendance lives in a notebook nobody can find.",
      fix: "Mark a whole batch in seconds, see month-on-month trends.",
    },
    {
      pain: "Fee follow-ups eat half your week.",
      fix: "Auto-flagged overdues so you know exactly who to follow up with.",
    },
    {
      pain: "You don't really know how the centre is doing.",
      fix: "A daily snapshot that surfaces the one number you should act on.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Stop running your centre out of a WhatsApp group.
        </h2>
        <p className="mt-3 text-muted-foreground">
          You opened a coaching centre to teach. Vidya Orbit handles everything
          else.
        </p>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.pain}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <p className="text-sm font-semibold text-[color:var(--brand-coral)]">
              The problem
            </p>
            <p className="mt-1 text-base font-medium">{it.pain}</p>
            <div className="my-4 h-px bg-border" />
            <p className="text-sm font-semibold text-[color:var(--brand-teal)]">
              With Vidya Orbit
            </p>
            <p className="mt-1 text-base text-muted-foreground">{it.fix}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureGrid() {
  const features = [
    {
      icon: Users,
      title: "Students & batches",
      body: "A clean roster with parent contacts, batch tags, fee status and history — searchable in one click.",
    },
    {
      icon: CalendarCheck,
      title: "Fast attendance",
      body: "Mark a full batch quickly. Daily and monthly views ready for parent conversations.",
    },
    {
      icon: Wallet,
      title: "Fees that follow themselves",
      body: "Track who paid, who didn't, and how much is due — with auto-generated receipts and overdue alerts.",
    },
    {
      icon: Receipt,
      title: "Branded receipts",
      body: "Numbered receipts with your centre name, ready to print or save as PDF from your browser.",
    },
    {
      icon: LineChart,
      title: "Analytics that matter",
      body: "The one metric that needs your attention today — not 40 charts you'll never open.",
    },
    {
      icon: ShieldCheck,
      title: "Team roles & permissions",
      body: "Invite tutors or admin staff with read or write access per area — billing stays with you.",
    },
  ];
  return (
    <section id="features" className="border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Everything your centre runs on. In one orbit.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Designed for owners who have 200 things on their plate and 0 minutes
            for a steep learning curve.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-card p-6 transition hover:border-[color:var(--brand-teal)]/60 hover:shadow-[var(--shadow-soft)]"
            >
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background:
                    "color-mix(in oklab, var(--brand-teal) 18%, transparent)",
                }}
              >
                <f.icon className="h-5 w-5 text-[color:var(--brand-teal)]" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">
                {f.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowStrip() {
  const steps = [
    { n: "1", t: "Add your institute", d: "Quick setup to get started." },
    { n: "2", t: "Import your students", d: "Upload your Excel or CSV file." },
    {
      n: "3",
      t: "Start collecting",
      d: "Mark attendance, record fees, share receipts.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            You can usually be set up within an afternoon.
          </h2>
          <p className="mt-3 text-muted-foreground">
            No training, no onboarding calls, no "implementation partner". Sign
            in, upload your student list, done.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              "Bulk-import students from spreadsheets",
              "Invite your staff with one WhatsApp link",
              "Branded receipts ready on day one",
              "Works on phone, tablet and laptop",
            ].map((b) => (
              <li key={b} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-teal)]" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <ol className="space-y-3">
          {steps.map((s) => (
            <li
              key={s.n}
              className="flex gap-4 rounded-2xl border border-border bg-card p-5"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold text-primary-foreground"
                style={{ background: "var(--primary)" }}
              >
                {s.n}
              </div>
              <div>
                <p className="font-semibold">{s.t}</p>
                <p className="text-sm text-muted-foreground">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ProofStrip() {
  const items = [
    {
      icon: Zap,
      t: "Quick to set up",
      d: "From signup to first attendance marked.",
    },
    {
      icon: HeartHandshake,
      t: "Built for real centres",
      d: "Designed with coaching owners in mind.",
    },
    {
      icon: ShieldCheck,
      t: "Your data is yours",
      d: "Encrypted data. Export anytime.",
    },
  ];
  return (
    <section className="border-y border-border/60 bg-card/30">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3">
        {items.map((it) => (
          <div key={it.t} className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background:
                  "color-mix(in oklab, var(--brand-saffron) 22%, transparent)",
              }}
            >
              <it.icon className="h-5 w-5 text-[color:var(--brand-saffron)]" />
            </div>
            <div>
              <p className="font-semibold">{it.t}</p>
              <p className="text-sm text-muted-foreground">{it.d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Honest pricing. Start free.
        </h2>
        <p className="mt-3 text-muted-foreground">
          Pay only when your centre grows. Cancel anytime.
        </p>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {APPROVED_PRICING.map((plan) => {
          const isRecommended = plan.code === "growth";
          const savingsLabel = getAnnualSavingsLabel(plan);
          return (
            <div
              key={plan.code}
              className={`rounded-2xl border bg-card p-5 ${
                isRecommended
                  ? "border-[color:var(--brand-teal)] shadow-[var(--shadow-lift)]"
                  : "border-border"
              }`}
            >
              {isRecommended && (
                <span className="mb-3 inline-flex rounded-full bg-[color:var(--brand-teal)]/15 px-2.5 py-0.5 text-xs font-semibold text-[color:var(--brand-teal)]">
                  Recommended
                </span>
              )}
              <h3 className="font-display text-lg font-bold">
                {plan.displayName}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {plan.tagline}
              </p>
              <div className="mt-4">
                <p className="font-display text-2xl font-bold">
                  {plan.monthlyPrice === 0
                    ? "Free"
                    : formatIndianPrice(plan.monthlyPrice)}
                </p>
                {plan.monthlyPrice > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      /month or {formatIndianPrice(plan.annualPrice)}/year
                    </p>
                    {savingsLabel && (
                      <p className="mt-0.5 text-xs font-medium text-[color:var(--brand-teal)]">
                        {savingsLabel}
                      </p>
                    )}
                    {plan.setupFee > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatIndianPrice(plan.setupFee)} one-time setup on
                        monthly (waived on annual)
                      </p>
                    )}
                  </>
                )}
              </div>
              <ul className="mt-4 space-y-1.5 text-xs">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--brand-teal)]" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={plan.code === "free" ? "/login" : "/pricing"}
                search={plan.code === "free" ? { mode: "signup" } : undefined}
                className="mt-4 block"
              >
                <Button
                  className="w-full"
                  size="sm"
                  variant={isRecommended ? "default" : "outline"}
                >
                  {plan.code === "free" ? "Start free" : "Learn more"}
                </Button>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "Is my data safe?",
      a: "Yes. Data is encrypted in transit and at rest, isolated per institute. You can export everything at any time.",
    },
    {
      q: "Can I move from Excel?",
      a: "Yes — upload your Excel or CSV file. You can usually be set up within an afternoon.",
    },
    {
      q: "Do students or parents need to install anything?",
      a: "No. Vidya Orbit is for you and your staff. You share receipts through WhatsApp the way you already do.",
    },
    {
      q: "Can I cancel?",
      a: "Anytime. You stay on the free plan with your data intact. If you are over the free student limit, existing students stay fully accessible — adding new ones is paused until you upgrade or archive some.",
    },
  ];
  return (
    <section id="faq" className="border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Frequently asked
        </h2>
        <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {f.q}
                <span className="ml-4 text-muted-foreground transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  const { whatsappUrl } = getContactConfig();
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div
        className="relative overflow-hidden rounded-3xl border border-border p-10 text-center sm:p-14"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--primary) 95%, black), color-mix(in oklab, var(--brand-teal) 35%, var(--primary)))",
        }}
      >
        <h2 className="font-display text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
          Bring your centre into one orbit.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
          Free for up to 25 students. Quick to set up. Cancel anytime.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/login" search={{ mode: "signup" }}>
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              Start free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          {whatsappUrl && (
            <a
              href={`${whatsappUrl}?text=${encodeURIComponent("I'd like to learn more about Vidya Orbit")}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                size="lg"
                variant="outline"
                className="w-full border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Talk to us on WhatsApp
              </Button>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  const { email, whatsappUrl } = getContactConfig();
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <LogoWordmark size={26} />
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link to="/login" className="hover:text-foreground">
            Sign in
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          {email && (
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" />
              Contact
            </a>
          )}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          )}
        </nav>
        <p>© {new Date().getFullYear()} Vidya Orbit</p>
      </div>
    </footer>
  );
}
