/**
 * Pricing display configuration — the single source of truth for prices shown on
 * the landing page, /pricing, and JSON-LD structured data.
 *
 * These display prices are separate from the internal plan codes and database limits.
 * Keep them in sync with server-side Razorpay checkout in billing-pricing.ts.
 */

export interface PlanDisplay {
  code: "free" | "starter" | "growth" | "large" | "campus";
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

/** Nov 1 2026 pricing. Yearly = pay 10 months; setup waived on yearly. */
export const CENTRE_SETUP_FEE = 2000;
export const CAMPUS_SETUP_FEE = 3000;
/** @deprecated Setup is per plan now (Centre ₹2,000, Campus ₹3,000). */
export const DFY_SETUP_FEE = CENTRE_SETUP_FEE;

/** Use this exact line anywhere WhatsApp automation is mentioned. */
export const WHATSAPP_COMING_SOON_LINE =
  "WhatsApp alerts coming soon, free when they arrive.";
/**
 * Optional. NOT rendered: conflicts with the current refund policy
 * (non-refundable once the period starts). Update /refund-policy + terms first.
 */
export const MONEY_BACK_LINE = "30-day money-back guarantee.";
export const CUSTOM_QUOTE_LINE =
  "Over ~800 students or more than one branch? Ask for a custom quote.";

export const APPROVED_PRICING: PlanDisplay[] = [
  {
    code: "free",
    displayName: "Free",
    tagline: "Small centres, self-serve",
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
      "Self-serve, no setup needed",
    ],
    ctaLabel: "Start free",
  },
  {
    code: "starter",
    displayName: "Spark",
    tagline: "Growing coaching centres",
    studentLimit: "Up to 50 students",
    monthlyPrice: 499,
    annualPrice: 4990,
    setupFee: 0,
    annualSetupFee: 0,
    features: [
      "Up to 50 students",
      "Everything in Free",
      "Analytics dashboard",
      "Free setup: Excel import + staff training",
    ],
    ctaLabel: "Get Spark",
  },
  {
    code: "growth",
    displayName: "Orbit",
    tagline: "Multi-batch institutions",
    studentLimit: "Up to 150 students",
    monthlyPrice: 999,
    annualPrice: 9990,
    setupFee: 0,
    annualSetupFee: 0,
    features: [
      "Up to 150 students",
      "Everything in Spark",
      "Free setup: Excel import + staff training",
      "Email & WhatsApp support",
    ],
    ctaLabel: "Choose Orbit",
  },
  {
    code: "large",
    displayName: "Centre",
    tagline: "Bigger centres",
    studentLimit: "Up to 400 students",
    monthlyPrice: 1499,
    annualPrice: 14990,
    setupFee: CENTRE_SETUP_FEE,
    annualSetupFee: 0,
    features: [
      "Up to 400 students",
      "Everything in Orbit",
      "Done for you setup",
      "Email & WhatsApp support",
    ],
    ctaLabel: "Choose Centre",
  },
  {
    code: "campus",
    displayName: "Campus",
    tagline: "Large institutes, up to ~800 students",
    studentLimit: "400+ students",
    monthlyPrice: 2499,
    annualPrice: 24990,
    setupFee: CAMPUS_SETUP_FEE,
    annualSetupFee: 0,
    features: [
      "400+ students",
      "Everything in Centre",
      "Done for you setup",
      "Priority WhatsApp support",
    ],
    ctaLabel: "Choose Campus",
  },
];

/** 12 × monthly minus annual (= 2 months). Setup fee is not included. */
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
    return `2 months free · setup waived`;
  }
  return `2 months free`;
}

export function dfySetupLine(): string {
  return `Setup is free on Spark and Orbit (we import your Excel and train your staff). Centre adds ${formatIndianPrice(CENTRE_SETUP_FEE)} and Campus ${formatIndianPrice(CAMPUS_SETUP_FEE)} on the first monthly invoice. Yearly plans waive setup.`;
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
