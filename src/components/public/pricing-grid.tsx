import { Link } from "@tanstack/react-router";
import { Check, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  APPROVED_PRICING,
  formatIndianPrice,
  getAnnualSavingsLabel,
  type PlanDisplay,
} from "@/lib/pricing-display";
import { getContactConfig, getWhatsAppHref } from "@/lib/contact-config";
import { CTA_START_FREE } from "@/lib/landing-copy";

function PaidPlanCtas({
  plan,
  isRecommended,
}: {
  plan: PlanDisplay;
  isRecommended: boolean;
}) {
  const { email } = getContactConfig();
  const planName = plan.displayName;
  const message = `Hi, I'd like the ${planName} plan (monthly/annual) for my centre.`;
  const wa = getWhatsAppHref(message);
  const emailSubject = `${planName} plan inquiry`;

  return (
    <div className="mt-6 flex flex-col gap-2">
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer">
          <Button
            className="w-full gap-1.5"
            variant={isRecommended ? "default" : "outline"}
            size="sm"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp us
          </Button>
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(message)}`}
        >
          <Button
            className="w-full gap-1.5"
            variant={wa ? "ghost" : isRecommended ? "default" : "outline"}
            size="sm"
          >
            <Mail className="h-3.5 w-3.5" />
            Email us
          </Button>
        </a>
      )}
    </div>
  );
}

export function PublicPricingGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {APPROVED_PRICING.map((plan) => {
        const isRecommended = plan.code === "growth";
        const savingsLabel = getAnnualSavingsLabel(plan);
        return (
          <div
            key={plan.code}
            className={
              "relative flex flex-col rounded-2xl border bg-card p-5 sm:p-6 " +
              (isRecommended
                ? "border-[color:var(--brand-teal)]/50 shadow-[var(--shadow-elevated)] material-thick"
                : "border-border/80 shadow-[var(--shadow-card)]")
            }
          >
            {isRecommended && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[color:var(--brand-teal)] px-3 py-1 text-[11px] font-semibold text-white">
                Recommended
              </span>
            )}
            <h3 className="font-display text-lg font-semibold sm:text-xl">
              {plan.displayName}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
            <div className="mt-5">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold">
                  {plan.monthlyPrice === 0
                    ? "Free"
                    : formatIndianPrice(plan.monthlyPrice)}
                </span>
                {plan.monthlyPrice !== 0 && (
                  <span className="text-sm text-muted-foreground">/month</span>
                )}
              </div>
              {plan.monthlyPrice > 0 && (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatIndianPrice(plan.annualPrice)}/year
                  </p>
                  {savingsLabel && (
                    <p className="mt-0.5 text-xs font-medium text-[color:var(--brand-teal)]">
                      {savingsLabel}
                    </p>
                  )}
                  {plan.setupFee > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatIndianPrice(plan.setupFee)} one-time setup on
                      monthly (waived on annual)
                    </p>
                  )}
                </>
              )}
            </div>
            <ul className="mt-5 flex-1 space-y-2.5 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-[color:var(--brand-teal)]" />
                  <span className="text-foreground/90">{f}</span>
                </li>
              ))}
            </ul>
            {plan.code === "free" ? (
              <Link to="/login" search={{ mode: "signup" }} className="mt-6">
                <Button className="w-full" variant="outline" size="sm">
                  {plan.ctaLabel || CTA_START_FREE}
                </Button>
              </Link>
            ) : (
              <PaidPlanCtas plan={plan} isRecommended={isRecommended} />
            )}
          </div>
        );
      })}
    </div>
  );
}
