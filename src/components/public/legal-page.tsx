import { Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { SkipToContent } from "@/components/skip-to-content";
import {
  GST_STATUS,
  LEGAL_ADDRESS,
  LEGAL_LAST_UPDATED,
  OPERATOR_CAPACITY,
  OPERATOR_NAME,
  PRODUCT_BUILDER_NAME,
} from "@/lib/legal";

export function LegalPageLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SkipToContent />
      <SiteHeader nav="pricing" />
      <main id="main-content">
        <div className="mx-auto max-w-3xl px-8 py-16 sm:px-16 sm:py-20">
          <Link to="/" className="text-sm text-slate hover:text-ink">
            ← Back to home
          </Link>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-slate">
            Last updated: {LEGAL_LAST_UPDATED}
          </p>
          <div className="mt-10 space-y-8">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={id ? "scroll-mt-24" : undefined}>
      <h2 className="font-display text-lg font-bold tracking-[-0.02em]">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-slate">{children}</div>
    </section>
  );
}

export function LegalPostalAddress({ labeled = false }: { labeled?: boolean }) {
  const address = <span className="text-ink">{LEGAL_ADDRESS}</span>;
  if (!labeled) return address;
  return <span>Postal address: {address}</span>;
}

export function LegalOperatorIntro() {
  return (
    <>
      <p>
        Vidya Orbit is operated by {OPERATOR_NAME}, {OPERATOR_CAPACITY} ("we").
        The product is built by {PRODUCT_BUILDER_NAME}.
      </p>
      <p className="mt-2">{GST_STATUS}</p>
      <p className="mt-2">
        <LegalPostalAddress labeled />
      </p>
    </>
  );
}
