/**
 * Public landing copy. Keep every product claim honest — see LANDING_CLAIMS.
 *
 * Malayalam line (native-speaker check needed):
 *   ഞങ്ങൾ എല്ലാം ഒരുക്കിത്തരാം — ഒരു തലവേദനയും വേണ്ട.
 */

export const LANDING_TITLE = "Vidya Orbit — We set up your coaching centre";
export const LANDING_DESCRIPTION =
  "For Kerala tuition and coaching centres. We import your students from Excel or CSV, set up batches and fees, add staff, and train you in 30 minutes. See who hasn't paid this month in one tap.";

export const HERO_EYEBROW = "Built in Valanchery, Kerala";
export const HERO_TITLE = "We set everything up for you, zero headache.";
/** One-line Malayalam of the setup promise. Flag for a native speaker. */
export const HERO_MALAYALAM =
  "ഞങ്ങൾ എല്ലാം ഒരുക്കിത്തരാം — ഒരു തലവേദനയും വേണ്ട.";
export const HERO_SUB =
  "After a call, Aryanand imports your students from your Excel or CSV file, sets up your batches and fees, adds your staff, and gives a 30-minute training. Then you can see who hasn't paid this month in one tap.";

export const FOUNDER_LINE =
  "I'm Aryanand, in Valanchery. There is no demo centre — I set yours up myself and stay on WhatsApp if anything is unclear.";

export const WHATSAPP_PREFILL =
  "Hi Aryanand, I run a coaching centre and I'd like Vidya Orbit set up for us.";

export const CTA_WHATSAPP = "WhatsApp Aryanand";
export const CTA_START_FREE = "Start free";

export type LandingClaim = {
  text: string;
  source: string;
};

/** Factual claims on the landing page and where the product backs them. */
export const LANDING_CLAIMS: LandingClaim[] = [
  {
    text: "We import students from an Excel or CSV upload (.xlsx / .xls / .csv), not by pasting.",
    source: "src/components/import-students-dialog.tsx accept=.xlsx,.xls,.csv",
  },
  {
    text: "Batches can be created with subject, timing, days, teacher and capacity.",
    source:
      "src/hooks/use-data.ts Batch type; src/routes/_authenticated/batches.tsx",
  },
  {
    text: "Each student can have a fee total and due date; the fees page shows paid, pending and overdue.",
    source: "src/routes/_authenticated/fees.tsx overdue/pending/paid filters",
  },
  {
    text: "You can see who still owes: fees dues tab plus dashboard overdue list.",
    source: "src/routes/_authenticated/fees.tsx; dashboard Overdue dues card",
  },
  {
    text: "Attendance is marked per batch, on the phone, with present / late / absent and All present.",
    source: "src/routes/_authenticated/attendance.tsx",
  },
  {
    text: "Staff can be invited with a join link that can be shared on WhatsApp.",
    source:
      "src/routes/_authenticated/settings.team.tsx Share on WhatsApp; src/lib/workspace.functions.ts inviteMember",
  },
  {
    text: "Numbered receipts show the centre name and can be printed or saved as PDF from the browser.",
    source: "src/routes/_authenticated/receipts.$paymentId.tsx window.print()",
  },
  {
    text: "Students store parent/guardian name and phone; the app does not message parents for you.",
    source:
      "src/components/student-dialog.tsx guardian fields; no parent WhatsApp send",
  },
  {
    text: "Free plan is up to 25 students. Analytics is a Starter+ feature, not on Free.",
    source:
      "src/lib/pricing-display.ts; src/routes/_authenticated/analytics.tsx hasMinPlan starter",
  },
  {
    text: "You can export students, batches, dues and payments as Excel or CSV.",
    source: "src/lib/export.ts used from students, batches and fees pages",
  },
  {
    text: "Paid plans are arranged by invoice; in-app Razorpay checkout is not live.",
    source:
      "src/lib/feature-flags.ts BILLING_DISABLED; src/routes/terms.tsx §6",
  },
];

export const BANNED_LANDING_PHRASES = [
  "paste from excel",
  "most popular",
  "most centres are up and running",
  "all core features",
  "advanced analytics",
  "dedicated help",
  "nothing is locked away",
  "set up in 5 minutes",
  "under 30 seconds",
  "two fields. 30 seconds",
  "no training, no onboarding",
];
