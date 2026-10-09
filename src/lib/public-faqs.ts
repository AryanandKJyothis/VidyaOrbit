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
  const growthSetup =
    growth.setupFee > 0
      ? ` ${growth.displayName} and ${large.displayName} add a ${formatIndianPrice(growth.setupFee)} setup fee on the first monthly invoice (waived on annual).`
      : "";
  return `${free.displayName} is ${formatIndianPrice(free.monthlyPrice)} for ${free.studentLimit.toLowerCase()}. ${starter.displayName} is ${formatIndianPrice(starter.monthlyPrice)}/month (${formatIndianPrice(starter.annualPrice)}/year) for ${starter.studentLimit.toLowerCase()}. ${growth.displayName} is ${formatIndianPrice(growth.monthlyPrice)}/month; ${large.displayName} is ${formatIndianPrice(large.monthlyPrice)}/month.${growthSetup} Paid plans are arranged by invoice; online payment is coming soon.`;
}

/** Landing-page owner FAQ. Prices are read from APPROVED_PRICING. */
export const LANDING_FAQS: FaqItem[] = [
  {
    q: "What is Vidya Orbit?",
    a: "Vidya Orbit is software for coaching and tuition centres in Kerala. You use it to manage students, batches, attendance, fees, staff and numbered receipts in one place — on your phone or a computer.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. Attendance is built for marking a batch on your phone in a few taps. Fees, students and receipts work in the same browser on phone or desktop. There is no separate app to install.",
  },
  {
    q: "Can it send fee reminders or receipts on WhatsApp?",
    a: "You still send receipts on WhatsApp yourself. The app does not message parents. Numbered receipts show your centre name; print or save as PDF from the browser, then share the way you already do.",
  },
  {
    q: "Is my data safe?",
    a: "Hosted on Supabase: encrypted in transit and at rest, isolated per institute. Only your authorised team can access it. You can export students, batches, dues and payments anytime. We never sell institute data.",
  },
  {
    q: "Do I have to set this up myself?",
    a: "No. WhatsApp or call Aryanand. We import your Excel or CSV, set up batches and fees, add staff, and train you for 30 minutes.",
  },
  {
    q: "How much does it cost?",
    a: landingPricingAnswer(),
  },
  {
    q: "Can I move from Excel?",
    a: "Yes — upload a .xlsx, .xls or .csv file. Pasting cells is not supported. The import template includes English and Malayalam instructions. We usually do this with you on the setup call.",
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
    a: "Contact us and we'll help you upgrade to a paid plan that fits your needs. Online payment is coming soon.",
  },
  {
    q: "Can I cancel or downgrade?",
    a: "Yes. Contact us and we'll help you adjust your plan the same day.",
  },
  {
    q: "Is my data safe?",
    a: "Yes. Data is encrypted in transit and at rest, isolated per institute, and only your authorised team can access it. We never sell or share institute data.",
  },
];

/** Used by tests to prove FAQ prices are not a second hardcoded table. */
export function landingFaqUsesDisplayPrices(): boolean {
  const answer = LANDING_FAQS.find((f) => f.q === "How much does it cost?")!.a;
  return APPROVED_PRICING.filter((p) => p.code !== "free").every((p) =>
    answer.includes(formatIndianPrice(p.monthlyPrice)),
  );
}
