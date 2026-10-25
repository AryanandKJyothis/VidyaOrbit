import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  APPROVED_PRICING,
  formatIndianPrice,
  type PlanDisplay,
} from "@/lib/pricing-display";
import { getWhatsAppHref } from "@/lib/contact-config";
import { useAuth } from "@/hooks/use-auth";
import {
  CTA_BOOK_DEMO,
  CTA_GET_SPARK,
  RAZORPAY_LIVE_LINE,
  STARTER_ROI_LINE,
  landingSignupCta,
} from "@/lib/landing-copy";
import { cn } from "@/lib/utils";

const PAID_PLANS = APPROVED_PRICING.filter((p) => p.code !== "free");

export function LandingPricing() {
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const annual = cycle === "annual";

  return (
    <div>
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Billing cycle"
          className="inline-flex border border-ink/20"
        >
          {(["monthly", "annual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cycle === c}
              className={cn(
                "h-10 min-w-28 px-4 text-sm font-semibold capitalize transition-colors duration-150 [transition-timing-function:var(--ease-out)]",
                cycle === c
                  ? "bg-ink text-paper"
                  : "bg-transparent text-ink hover:bg-ink/5",
              )}
              onClick={() => setCycle(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid border-t border-ink/20 md:grid-cols-3">
        {PAID_PLANS.map((plan) => (
          <PlanColumn key={plan.code} plan={plan} annual={annual} />
        ))}
      </div>

      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-slate">
        Free for up to 25 students if you want to look around first, no card
        required. {RAZORPAY_LIVE_LINE}{" "}
        <Link to="/pricing" className="text-ink underline underline-offset-4">
          Full plan list
        </Link>
        .
      </p>
    </div>
  );
}

function PlanColumn({ plan, annual }: { plan: PlanDisplay; annual: boolean }) {
  const highlight = plan.code === "growth";
  const price = annual ? plan.annualPrice : plan.monthlyPrice;
  const period = annual ? "/yr" : "/mo";
  const showSetup = !annual && plan.setupFee > 0;
  const message = `Hi, I'd like the ${plan.displayName} plan (${annual ? "annual" : "monthly"}) for my centre.`;
  const wa = getWhatsAppHref(message);
  const { session } = useAuth();
  const signup = landingSignupCta(Boolean(session));

  return (
    <article
      className={cn(
        "flex flex-col border-ink/20 px-6 py-8 md:border-r md:last:border-r-0",
        highlight ? "bg-orbit-blue text-paper" : "bg-transparent text-ink",
      )}
    >
      <div className="flex items-center gap-2">
        <h3 className="font-display text-xl font-bold tracking-[-0.03em]">
          {plan.displayName}
        </h3>
        {highlight && (
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "#F05A28" }}
            aria-hidden
          />
        )}
      </div>
      <p
        className={cn(
          "mt-1 text-sm",
          highlight ? "text-paper/75" : "text-slate",
        )}
      >
        {plan.studentLimit}
      </p>
      <p className="mt-6 font-display text-5xl font-bold leading-none tracking-[-0.04em]">
        {formatIndianPrice(price)}
        <span
          className={cn(
            "ml-1 align-middle font-sans text-base font-normal tracking-normal",
            highlight ? "text-paper/70" : "text-slate",
          )}
        >
          {period}
        </span>
      </p>
      {plan.code === "starter" && (
        <p
          className={cn(
            "mt-3 text-sm leading-relaxed",
            highlight ? "text-paper/80" : "text-slate",
          )}
        >
          {STARTER_ROI_LINE}
        </p>
      )}
      {showSetup && (
        <p
          className={cn(
            "mt-3 text-sm leading-relaxed",
            highlight ? "text-paper/80" : "text-slate",
          )}
        >
          Optional DFY setup {formatIndianPrice(plan.setupFee)} on first monthly
          invoice. Waived on annual.
        </p>
      )}
      {annual && plan.setupFee > 0 && (
        <p
          className={cn(
            "mt-3 text-sm leading-relaxed",
            highlight ? "text-paper/80" : "text-slate",
          )}
        >
          Optional DFY setup waived on annual billing.
        </p>
      )}
      <ul className="mt-6 flex-1 space-y-2 text-sm">
        {plan.features
          .filter((f) => f !== plan.studentLimit)
          .map((f) => (
            <li
              key={f}
              className={cn(
                "border-t py-2",
                highlight ? "border-paper/20" : "border-ink/15",
              )}
            >
              {f}
            </li>
          ))}
      </ul>
      {plan.code === "starter" ? (
        <Link
          to={signup.to}
          search={"search" in signup ? signup.search : undefined}
          className="mt-8"
        >
          <Button
            className={cn(
              "h-11 w-full !rounded-[4px]",
              highlight
                ? "bg-paper text-ink hover:bg-paper/90"
                : "bg-orbit-blue text-paper hover:bg-orbit-blue/90",
            )}
          >
            {signup.to === "/dashboard" ? signup.label : CTA_GET_SPARK}
          </Button>
        </Link>
      ) : wa ? (
        <a href={wa} target="_blank" rel="noreferrer" className="mt-8">
          <Button
            className={cn(
              "h-11 w-full !rounded-[4px]",
              highlight
                ? "bg-paper text-ink hover:bg-paper/90"
                : "bg-orbit-blue text-paper hover:bg-orbit-blue/90",
            )}
          >
            {CTA_BOOK_DEMO}
          </Button>
        </a>
      ) : (
        <Link
          to={signup.to}
          search={"search" in signup ? signup.search : undefined}
          className="mt-8"
        >
          <Button
            className={cn(
              "h-11 w-full !rounded-[4px]",
              highlight
                ? "bg-paper text-ink hover:bg-paper/90"
                : "bg-orbit-blue text-paper hover:bg-orbit-blue/90",
            )}
          >
            {signup.label}
          </Button>
        </Link>
      )}
    </article>
  );
}
