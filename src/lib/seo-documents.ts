/**
 * Crawl documents served from /public: robots.txt, sitemap.xml, llms.txt.
 * Prices in llms.txt come from APPROVED_PRICING — never a second table.
 */

import {
  DEFAULT_EMAIL,
  DEFAULT_PHONE,
  DEFAULT_WHATSAPP_URL,
  FOUNDER_NAME,
  FOUNDER_TOWN,
} from "@/lib/contact-config";
import { LANDING_DESCRIPTION, LANDING_TITLE } from "@/lib/landing-copy";
import {
  APPROVED_PRICING,
  formatIndianPrice,
  getAnnualSavingsLabel,
} from "@/lib/pricing-display";
import { SITEMAP_PATHS, canonicalUrl } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const AI_CRAWLERS = [
  "Googlebot",
  "Bingbot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot",
] as const;

/** Authenticated app, invite tokens, and API — not for search or AI indexes. */
export const ROBOTS_DISALLOW = [
  "/dashboard",
  "/students",
  "/fees",
  "/attendance",
  "/batches",
  "/analytics",
  "/billing",
  "/plan",
  "/settings",
  "/invites",
  "/admin",
  "/receipts",
  "/api",
  "/join",
] as const;

function robotsGroup(userAgents: readonly string[]): string {
  const agents = userAgents.map((ua) => `User-agent: ${ua}`).join("\n");
  const disallow = ROBOTS_DISALLOW.map((p) => `Disallow: ${p}`).join("\n");
  return `${agents}\nAllow: /\n${disallow}`;
}

export function buildRobotsTxt(): string {
  return [
    `# ${SITE_NAME}`,
    `# ${SITE_URL}`,
    "",
    robotsGroup(AI_CRAWLERS),
    "",
    robotsGroup(["*"]),
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}

export function buildSitemapXml(): string {
  const urls = SITEMAP_PATHS.map(
    (path) =>
      `  <url>\n    <loc>${canonicalUrl(path)}</loc>\n    <changefreq>weekly</changefreq>\n  </url>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function planLlmsLine(p: (typeof APPROVED_PRICING)[number]): string {
  const monthly = formatIndianPrice(p.monthlyPrice);
  if (p.annualPrice <= 0) {
    return `- ${p.displayName}: ${monthly}/month — ${p.studentLimit}. ${p.tagline}.`;
  }
  const annual = formatIndianPrice(p.annualPrice);
  const save = getAnnualSavingsLabel(p);
  const setup =
    p.setupFee > 0
      ? ` First monthly invoice includes a ${formatIndianPrice(p.setupFee)} setup fee (waived on annual).`
      : "";
  const saveBit = save ? ` ${save}.` : "";
  return `- ${p.displayName}: ${monthly}/month or ${annual}/year — ${p.studentLimit}.${setup}${saveBit}`;
}

export function buildLlmsTxt(): string {
  const plans = APPROVED_PRICING.map(planLlmsLine).join("\n");
  return `# ${SITE_NAME}

> ${LANDING_TITLE}

${LANDING_DESCRIPTION}

Vidya Orbit is a SaaS product for coaching centres and tuition centres in Kerala. The founder, ${FOUNDER_NAME}, is based in ${FOUNDER_TOWN} (Malappuram district). After a WhatsApp or phone call he imports the centre's students from Excel or CSV, sets up batches and fees, adds staff, and gives a 30-minute training.

The product screens are in English. The student import template includes Malayalam instructions. Setup help is on WhatsApp from Valanchery.

## Who it is for

Owners of coaching centres, tuition centres, and small institutes who currently track students, attendance and fees in notebooks, WhatsApp chats, or spreadsheets.

## Features

- Students and batches (name, parent/guardian phone, fee total, due date)
- Attendance on a phone: present / late / absent, including All present
- Fee tracking: paid, pending, overdue; cash, UPI or bank
- Numbered receipts with the centre name; print or save as PDF, then send on WhatsApp yourself
- Staff invites with a join link (owner chooses whether staff can see fees)
- Excel / CSV import (.xlsx, .xls, .csv) — pasting cells is not supported
- Export students, batches, dues and payments as Excel or CSV
- Analytics dashboard on Starter and above

The app does not message parents. Receipts and reminders are sent by the centre on WhatsApp the way they already do.

## Pricing (INR)

Prices below are the public plans in the product. Paid plans are arranged by invoice; in-app online payment is coming soon.

${plans}

## Location and contact

- Place: Valanchery, Malappuram, Kerala, India
- Founder: ${FOUNDER_NAME}
- Phone: ${DEFAULT_PHONE}
- WhatsApp: ${DEFAULT_WHATSAPP_URL}
- Email: ${DEFAULT_EMAIL}

## URLs

- Home: ${SITE_URL}/
- Pricing: ${SITE_URL}/pricing
- Sign in: ${SITE_URL}/login
- Privacy: ${SITE_URL}/privacy
- Terms: ${SITE_URL}/terms
`;
}
