/**
 * Pricing display configuration — the single source of truth for prices shown on
 * the landing page, /pricing, and JSON-LD structured data.
 *
 * These display prices are separate from the internal plan codes and database limits.
 * When Razorpay payments go live (PR #7), server-side prices should be synced to match
 * this display config.
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
    displayName: "Starter",
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
    ctaLabel: "Choose Starter",
  },
  {
    code: "growth",
    displayName: "Growth",
    tagline: "Multi-batch institutions",
    studentLimit: "Up to 500 students",
    monthlyPrice: 999,
    annualPrice: 10000,
    setupFee: 5000,
    annualSetupFee: 0,
    features: [
      "Up to 500 students",
      "Everything in Starter",
      "Email & WhatsApp support",
    ],
    ctaLabel: "Choose Growth",
  },
  {
    code: "large",
    displayName: "Large",
    tagline: "Large institutions",
    studentLimit: "Unlimited students",
    monthlyPrice: 2499,
    annualPrice: 25000,
    setupFee: 5000,
    annualSetupFee: 0,
    features: [
      "Unlimited students",
      "Everything in Growth",
      "Email & WhatsApp support",
    ],
    ctaLabel: "Choose Large",
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
    return `Save ${formatIndianPrice(savings)} + free setup`;
  }
  return `Save ${formatIndianPrice(savings)}`;
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
