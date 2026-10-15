/**
 * Public landing copy. Keep every product claim honest — see LANDING_CLAIMS.
 *
 * Malayalam line (native-speaker check needed):
 *   ഞങ്ങൾ എല്ലാം ഒരുക്കിത്തരാം — ഒരു തലവേദനയും വേണ്ട.
 */

export const LANDING_TITLE =
  "Vidya Orbit — Coaching centre management software in Kerala";
export const LANDING_DESCRIPTION =
  "Vidya Orbit is coaching and tuition centre software for Kerala — attendance, fees, students, staff and receipts. Built in Valanchery, Malappuram.";

export const HERO_EYEBROW = "For owners and managers in Kerala";
export const HERO_TITLE = "See who came. Who paid. Who still owes.";
/** One-line Malayalam of the setup promise. Flag for a native speaker. */
export const HERO_MALAYALAM =
  "ഞങ്ങൾ എല്ലാം ഒരുക്കിത്തരാം — ഒരു തലവേദനയും വേണ്ട.";
export const HERO_SUB =
  "Software for tuition and coaching centre owners. Mark attendance by batch. Track fees. Send overdue reminders. We set it up. We train your staff.";

export const FOUNDER_LINE =
  "I'm Aryanand, in Valanchery. I set your centre up myself and stay on WhatsApp if anything is unclear.";

export const WHATSAPP_PREFILL =
  "Hi Aryanand, I run a coaching centre and I'd like a free demo of Vidya Orbit.";

export const CTA_WHATSAPP = "WhatsApp Aryanand";
export const CTA_START_FREE = "Start free";
export const CTA_BOOK_DEMO = "Book a free demo";
export const CTA_FINAL = "Get your centre into one orbit.";

export const AUDIENCE_LINE =
  "Not a student app. Built for the people who run the centre.";

export const WORK_STRIP = [
  "Attendance",
  "Fee tracking",
  "Batches",
  "Overdue reminders",
] as const;

export const TAGLINE_LINES = [
  "The register, the fees, the batches.",
  "One orbit for the team who runs them.",
] as const;

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
    text: "Numbered receipts show the centre name and can be printed or saved as PDF from the browser. A parent can also open a private receipt link.",
    source:
      "src/routes/_authenticated/receipts.$paymentId.tsx window.print(); src/routes/r.$token.tsx",
  },
  {
    text: "Students store parent/guardian name and phone. VidyaOrbit prepares a WhatsApp fee reminder with the centre UPI link; the owner sends it, and the parent pays the centre.",
    source:
      "src/lib/fee-reminder.ts; src/routes/_authenticated/fees.tsx Remind on WhatsApp",
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
    text: "Paid plans can be paid in the app through Razorpay, or arranged with us.",
    source:
      "src/routes/_authenticated/plan.tsx RazorpayCheckout; src/routes/api/billing",
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
  "coming soon",
  "checkout is not live",
];
