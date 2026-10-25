/**
 * Pricing display configuration — the single source of truth for prices shown on
 * the landing page, /pricing, and JSON-LD structured data.
 *
 * These display prices are separate from the internal plan codes and database limits.
 * Keep them in sync with server-side Razorpay checkout in billing-pricing.ts.
 */

export interface PlanDisplay {
  code: "free" | "starter" | "growth" | "large";
  displayName: string;
  tagline: string;
  studentLimit: string;
  monthlyPrice: number;
  annualPrice: number;
  setupFee: number;
  annualSetupFee: number;
  features: string[];
  ctaLabel: string;
}

/** Optional done-for-you onboarding. Charged on first monthly Orbit/Centre only. */
export const DFY_SETUP_FEE = 5000;

export const APPROVED_PRICING: PlanDisplay[] = [
  {
    code: "free",
    displayName: "Free",
    tagline: "For trying things out",
    studentLimit: "Up to 25 students",
    monthlyPrice: 0,
    annualPrice: 0,
    setupFee: 0,
    annualSetupFee: 0,
    features: [
      "Up to 25 students",
      "Student & batch management",
      "Daily attendance",
      "Basic fee tracking",
      "Email sign-in",
    ],
    ctaLabel: "Start free",
  },
  {
    code: "starter",
    displayName: "Spark",
    tagline: "Growing coaching centres",
    studentLimit: "Up to 100 students",
    monthlyPrice: 499,
    annualPrice: 4999,
    setupFee: 0,
    annualSetupFee: 0,
    features: [
      "Up to 100 students",
      "Everything in Free",
      "Analytics dashboard",
      "Email & WhatsApp support",
    ],
    ctaLabel: "Get Spark",
  },
  {
    code: "growth",
    displayName: "Orbit",
    tagline: "Multi-batch institutions",
    studentLimit: "Up to 500 students",
    monthlyPrice: 999,
    annualPrice: 10000,
    setupFee: DFY_SETUP_FEE,
    annualSetupFee: 0,
    features: [
      "Up to 500 students",
      "Everything in Spark",
      "Email & WhatsApp support",
    ],
    ctaLabel: "Choose Orbit",
  },
  {
    code: "large",
    displayName: "Centre",
    tagline: "Bigger centres",
    studentLimit: "Unlimited students",
    monthlyPrice: 1499,
    annualPrice: 15000,
    setupFee: DFY_SETUP_FEE,
    annualSetupFee: 0,
    features: [
      "Unlimited students",
      "Everything in Orbit",
      "Email & WhatsApp support",
    ],
    ctaLabel: "Choose Centre",
  },
];

/** 12 × monthly minus annual. Setup fee is not included. */
export function getAnnualSavings(plan: PlanDisplay): number {
  return plan.monthlyPrice * 12 - plan.annualPrice;
}

export function formatIndianPrice(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function getAnnualSavingsLabel(plan: PlanDisplay): string | null {
  const savings = getAnnualSavings(plan);
  if (savings <= 0) return null;
  if (plan.setupFee > 0) {
    return `Save ${formatIndianPrice(savings)} · DFY setup waived`;
  }
  return `Save ${formatIndianPrice(savings)}`;
}

export function dfySetupLine(): string {
  return `Optional done for you setup is ${formatIndianPrice(DFY_SETUP_FEE)}. Added on the first monthly Orbit or Centre invoice. Not charged on Spark, annual plans, or if you already paid it.`;
}

export function getPlanByCode(code: string): PlanDisplay | undefined {
  return APPROVED_PRICING.find((p) => p.code === code);
}

export function jsonLdOffers(pageUrl: string) {
  return APPROVED_PRICING.flatMap((p) => {
    const monthly = {
      "@type": "Offer",
      name: `${p.displayName} (monthly)`,
      price: p.monthlyPrice,
      priceCurrency: "INR",
      url: pageUrl,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: p.monthlyPrice,
        priceCurrency: "INR",
        billingDuration: "P1M",
      },
    };
    if (p.annualPrice <= 0) return [monthly];
    return [
      monthly,
      {
        "@type": "Offer",
        name: `${p.displayName} (annual)`,
        price: p.annualPrice,
        priceCurrency: "INR",
        url: pageUrl,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: p.annualPrice,
          priceCurrency: "INR",
          billingDuration: "P1Y",
        },
      },
    ];
  });
}
