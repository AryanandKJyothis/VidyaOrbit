import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LogoWordmark } from "@/components/logo";
import { PLANS } from "@/hooks/use-subscription";
import { Check, ArrowRight, ShieldCheck, MessageCircle } from "lucide-react";

const SITE_URL = "https://vidyaorbit.in";
const TITLE = "Pricing — Vidya Orbit";
const DESC =
  "Simple INR pricing for Indian coaching centres. Start free for up to 25 students. Upgrade only when you grow. Cancel anytime, refund within 7 days.";

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
          offers: PLANS.map((p) => ({
            "@type": "Offer",
            name: p.name,
            price: p.price,
            priceCurrency: "INR",
            url: SITE_URL + "/pricing",
          })),
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
    a: "You can still view and manage existing students. Adding new ones is paused until you upgrade — your data is never deleted.",
  },
  {
    q: "How does billing work in India?",
    a: "All plans are billed in INR via UPI, cards, or net banking through Razorpay. GST invoices are issued automatically.",
  },
  {
    q: "Can I cancel or downgrade?",
    a: "Anytime. Email or WhatsApp us and we'll process it the same day. Full refund within 7 days of payment, no questions asked.",
  },
  {
    q: "Is my data safe?",
    a: "Yes. Data is encrypted in transit and at rest, backed up daily, and only your authorised team can access it. We never sell or share institute data.",
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center">
            <LogoWordmark />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                Sign in
              </Button>
            </Link>
            <Link to="/login">
              <Button size="sm">
                Start free
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

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
                Start free. Upgrade only when your centre grows. No setup fees, no hidden charges,
                refundable within 7 days.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => {
              const popular = p.code === "growth";
              return (
                <div
                  key={p.code}
                  className={
                    "relative flex flex-col rounded-2xl border p-6 transition " +
                    (popular
                      ? "border-[color:var(--brand-teal)]/60 bg-card shadow-[var(--shadow-lift)]"
                      : "border-border bg-card hover:shadow-sm")
                  }
                >
                  {popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[color:var(--brand-teal)] px-3 py-1 text-[11px] font-semibold text-white">
                      Most popular
                    </span>
                  )}
                  <div className="flex items-baseline justify-between">
                    <h2 className="font-display text-xl font-semibold">{p.name}</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold">
                      {p.price === 0 ? "Free" : `₹${p.price.toLocaleString("en-IN")}`}
                    </span>
                    {p.price !== 0 && (
                      <span className="text-sm text-muted-foreground">/month</span>
                    )}
                  </div>
                  <ul className="mt-5 space-y-2.5 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 flex-none text-[color:var(--brand-teal)]" />
                        <span className="text-foreground/90">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/login" className="mt-6">
                    <Button
                      className="w-full"
                      variant={popular ? "default" : "outline"}
                      size="sm"
                    >
                      {p.price === 0 ? "Start free" : `Choose ${p.name}`}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--brand-teal)]" />
              Encrypted &amp; backed up daily
            </span>
            <span>UPI · Cards · Net banking</span>
            <span>GST invoices included</span>
            <span>7-day refund</span>
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
                    <span className="mr-2 inline-block transition group-open:rotate-90">›</span>
                    {f.q}
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-center">
              <h3 className="font-display text-xl font-semibold">Still have questions?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                We reply within a few hours. Pick whichever you prefer.
              </p>
              <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a href="https://wa.me/919999999999" target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <MessageCircle className="mr-1.5 h-4 w-4" />
                    WhatsApp us
                  </Button>
                </a>
                <a href="mailto:hello@vidyaorbit.in">
                  <Button variant="ghost" size="sm">
                    hello@vidyaorbit.in
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:px-6">
            <div className="flex items-center gap-2">
              <LogoWordmark />
            </div>
            <div className="flex items-center gap-4">
              <Link to="/" className="hover:text-foreground">
                Home
              </Link>
              <Link to="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link to="/terms" className="hover:text-foreground">
                Terms
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
