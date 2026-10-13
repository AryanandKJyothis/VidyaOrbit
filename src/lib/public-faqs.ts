/**
 * On-page FAQs for public marketing pages. JSON-LD FAQPage must match these
 * strings exactly — do not fork answers in route files.
 */

import {
  APPROVED_PRICING,
  formatIndianPrice,
  getPlanByCode,
} from "@/lib/pricing-display";

export type FaqItem = { q: string; a: string };

function landingPricingAnswer(): string {
  const free = getPlanByCode("free")!;
  const starter = getPlanByCode("starter")!;
  const growth = getPlanByCode("growth")!;
  const large = getPlanByCode("large")!;
  return `${free.displayName} is ${formatIndianPrice(free.monthlyPrice)} for ${free.studentLimit.toLowerCase()}. ${starter.displayName} is ${formatIndianPrice(starter.monthlyPrice)}/month (${formatIndianPrice(starter.annualPrice)}/year) for ${starter.studentLimit.toLowerCase()}. ${growth.displayName} is ${formatIndianPrice(growth.monthlyPrice)}/month (${formatIndianPrice(growth.annualPrice)}/year); ${large.displayName} is ${formatIndianPrice(large.monthlyPrice)}/month (${formatIndianPrice(large.annualPrice)}/year). Pay a paid plan in the app on the Plan page through Razorpay, or contact us to arrange it.`;
}

function setupFeeAnswer(): string {
  const growth = getPlanByCode("growth")!;
  const large = getPlanByCode("large")!;
  const starter = getPlanByCode("starter")!;
  return `Yes. ${growth.displayName} and ${large.displayName} add a ${formatIndianPrice(growth.setupFee)} setup fee on the first monthly invoice. It is waived on annual plans. ${starter.displayName} has no setup fee.`;
}

/** Landing-page owner FAQ. Prices are read from APPROVED_PRICING. */
export const LANDING_FAQS: FaqItem[] = [
  {
    q: "Is this for students?",
    a: "No. Vidya Orbit is for owners, managers and staff who run a tuition or coaching centre. Students and parents do not log in.",
  },
  {
    q: "What does setup include?",
    a: "Book a free demo on WhatsApp. We import your Excel or CSV, set up batches and fees, add staff, and train your team for 30 minutes.",
  },
  {
    q: "Can I switch plans?",
    a: "Yes. Open Plan in the app and pay through Razorpay, or contact us. You can move up or down; existing data stays. Changes take effect at the end of the current billing period where applicable.",
  },
  {
    q: "Is there a setup fee?",
    a: setupFeeAnswer(),
  },
  {
    q: "How much does it cost?",
    a: landingPricingAnswer(),
  },
  {
    q: "Is my data safe?",
    a: "Hosted on Supabase: encrypted in transit and at rest, isolated per institute. Only your authorised team can access it. You can export students, batches, dues and payments anytime. We never sell institute data.",
  },
  {
    q: "Do you support Malayalam?",
    a: "Product screens are in English. The student import template includes Malayalam instructions, and Aryanand helps on WhatsApp in Malayalam and English.",
  },
  {
    q: "Can I move from Excel?",
    a: "Yes — upload a .xlsx, .xls or .csv file. Pasting cells is not supported. The import template includes English and Malayalam instructions. We usually do this with you on the setup call.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. The Free plan supports up to 25 students with no card required. Use it as long as you like.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Email us to cancel. Access continues to the end of the paid period, then your account reverts to Free and existing data stays accessible. See the Refunds & cancellations page for when a refund is given.",
  },
  {
    q: "Can it send fee reminders or receipts on WhatsApp?",
    a: "VidyaOrbit prepares a WhatsApp message with the student name, month, amount due, your centre name, and your centre's UPI payment link. You tap send. The parent pays your centre directly. After you mark the fee received, share the numbered receipt the same way, or print it from the browser.",
  },
];

export const PRICING_FAQS: FaqItem[] = [
  {
    q: "Can I really start free?",
    a: `Yes. The Free plan supports ${getPlanByCode("free")!.studentLimit.toLowerCase()} with no credit card required. Use it as long as you like.`,
  },
  {
    q: "What happens if I cross my student limit?",
    a: "Existing data stays safe and usable. Adding new students is paused until you upgrade.",
  },
  {
    q: "How do I upgrade?",
    a: "Open Plan in the app and pay through Razorpay, or contact us and we'll help you upgrade to a paid plan that fits your needs.",
  },
  {
    q: "Can I cancel or downgrade?",
    a: "Yes. Contact us and we'll help you adjust your plan the same day. Changes take effect at the end of the current billing period where applicable.",
  },
  {
    q: "What is the refund policy?",
    a: "Paid plans are one-time Razorpay payments for a monthly or annual period, with no auto-renewal. Fees are non-refundable once the period starts, except duplicate or erroneous charges, a setup fee charged when one was already paid, or a plan that wasn't activated. See the Refunds & cancellations page.",
  },
  {
    q: "Is my data safe?",
    a: "Yes. Data is encrypted in transit and at rest, isolated per institute, and only your authorised team can access it. We never sell or share institute data.",
  },
  {
    q: "Is there a setup fee?",
    a: setupFeeAnswer(),
  },
];

/** Used by tests to prove FAQ prices are not a second hardcoded table. */
export function landingFaqUsesDisplayPrices(): boolean {
  const blob = LANDING_FAQS.map((f) => f.a).join(" ");
  const monthlyOk = APPROVED_PRICING.filter((p) => p.code !== "free").every(
    (p) => blob.includes(formatIndianPrice(p.monthlyPrice)),
  );
  const setupOk = APPROVED_PRICING.filter((p) => p.setupFee > 0).every((p) =>
    blob.includes(formatIndianPrice(p.setupFee)),
  );
  return monthlyOk && setupOk;
}
