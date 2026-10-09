/**
 * Public-page SEO: unique titles/descriptions, canonicals, Open Graph,
 * Twitter cards, JSON-LD, and optional search-console verification.
 *
 * Verification tokens are not shipped. When you have them, set
 * VITE_GOOGLE_SITE_VERIFICATION and/or VITE_BING_SITE_VERIFICATION
 * (see env.example). File verification is a static HTML file in /public.
 */

import {
  DEFAULT_EMAIL,
  DEFAULT_PHONE,
  DEFAULT_WHATSAPP_URL,
  FOUNDER_NAME,
  getContactConfig,
} from "@/lib/contact-config";
import { LANDING_DESCRIPTION, LANDING_TITLE } from "@/lib/landing-copy";
import { LANDING_FAQS, PRICING_FAQS, type FaqItem } from "@/lib/public-faqs";
import { jsonLdOffers } from "@/lib/pricing-display";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export { SITE_NAME, SITE_URL };

export const OG_IMAGE_PATH = "/og-image.png";
export const OG_IMAGE_URL = `${SITE_URL}${OG_IMAGE_PATH}`;
export const OG_IMAGE_WIDTH = "1200";
export const OG_IMAGE_HEIGHT = "630";
export const OG_IMAGE_ALT =
  "Vidya Orbit — coaching and tuition centre software for Kerala";
export const LOGO_URL = `${SITE_URL}/logo.png`;

export type PublicPageSeo = {
  title: string;
  description: string;
  path: string;
  /** Utility/auth pages that should not appear in search. */
  noindex?: boolean;
};

export const PUBLIC_PAGES = {
  home: {
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    path: "/",
  },
  pricing: {
    title: "Vidya Orbit Pricing — Tuition centre software in INR",
    description:
      "INR plans for coaching and tuition centres in Kerala. Start free for up to 25 students, then Starter, Growth or Large as you grow. Built in Valanchery, Malappuram.",
    path: "/pricing",
  },
  login: {
    title: "Sign in to Vidya Orbit",
    description:
      "Log in or create a free Vidya Orbit account to manage students, attendance, fees and receipts for your coaching or tuition centre.",
    path: "/login",
  },
  privacy: {
    title: "Privacy Policy — Vidya Orbit",
    description:
      "How Vidya Orbit handles student, fee and attendance data for coaching centres in Kerala. Isolation per institute, encryption in transit and at rest.",
    path: "/privacy",
  },
  terms: {
    title: "Terms of Service — Vidya Orbit",
    description:
      "Terms of service for Vidya Orbit, coaching and tuition centre management software operated from Valanchery, Malappuram, Kerala.",
    path: "/terms",
  },
  forgotPassword: {
    title: "Forgot password — Vidya Orbit",
    description:
      "Request a password reset link for your Vidya Orbit coaching centre account.",
    path: "/forgot-password",
    noindex: true,
  },
  resetPassword: {
    title: "Choose a new password — Vidya Orbit",
    description:
      "Set a new password for your Vidya Orbit coaching centre account.",
    path: "/reset-password",
    noindex: true,
  },
  join: {
    title: "You've been invited — Vidya Orbit",
    description: "Join your team's workspace on Vidya Orbit.",
    path: "/join",
    noindex: true,
  },
} as const satisfies Record<string, PublicPageSeo>;

/** Indexable marketing URLs for sitemap.xml. */
export const SITEMAP_PATHS = [
  PUBLIC_PAGES.home.path,
  PUBLIC_PAGES.pricing.path,
  PUBLIC_PAGES.login.path,
  PUBLIC_PAGES.privacy.path,
  PUBLIC_PAGES.terms.path,
] as const;

export function canonicalUrl(path: string): string {
  if (path === "/" || path === "") return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function verificationMeta(): { name: string; content: string }[] {
  const tags: { name: string; content: string }[] = [];
  const google = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION;
  const bing = import.meta.env.VITE_BING_SITE_VERIFICATION;
  if (typeof google === "string" && google.trim()) {
    tags.push({ name: "google-site-verification", content: google.trim() });
  }
  if (typeof bing === "string" && bing.trim()) {
    tags.push({ name: "msvalidate.01", content: bing.trim() });
  }
  return tags;
}

export function pageHead(page: PublicPageSeo, jsonLd?: unknown) {
  const url = canonicalUrl(page.path);
  return {
    meta: [
      { title: page.title },
      { name: "description", content: page.description },
      ...(page.noindex
        ? [{ name: "robots", content: "noindex, nofollow" as const }]
        : []),
      { property: "og:title", content: page.title },
      { property: "og:description", content: page.description },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:locale", content: "en_IN" },
      { property: "og:image", content: OG_IMAGE_URL },
      { property: "og:image:width", content: OG_IMAGE_WIDTH },
      { property: "og:image:height", content: OG_IMAGE_HEIGHT },
      { property: "og:image:alt", content: OG_IMAGE_ALT },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: page.title },
      { name: "twitter:description", content: page.description },
      { name: "twitter:image", content: OG_IMAGE_URL },
      { name: "twitter:image:alt", content: OG_IMAGE_ALT },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: jsonLd
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify(jsonLd),
          },
        ]
      : [],
  };
}

function faqJsonLd(faqs: FaqItem[], pageUrl: string) {
  return {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    url: pageUrl,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };
}

export function organizationJsonLd() {
  const contact = getContactConfig();
  const telephone = contact.phone ?? DEFAULT_PHONE;
  const email = contact.email ?? DEFAULT_EMAIL;
  const whatsapp = contact.whatsappUrl ?? DEFAULT_WHATSAPP_URL;
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: LOGO_URL,
    image: OG_IMAGE_URL,
    email,
    telephone,
    sameAs: [whatsapp],
    founder: {
      "@type": "Person",
      name: FOUNDER_NAME,
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Valanchery",
      addressRegion: "Malappuram",
      addressCountry: "IN",
    },
    areaServed: [
      { "@type": "AdministrativeArea", name: "Kerala" },
      { "@type": "AdministrativeArea", name: "Malappuram" },
      { "@type": "AdministrativeArea", name: "Valanchery" },
    ],
  };
}

export function webSiteJsonLd() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: LANDING_DESCRIPTION,
    inLanguage: "en-IN",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function softwareApplicationJsonLd(pageUrl: string) {
  return {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#app`,
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: LANDING_DESCRIPTION,
    url: SITE_URL,
    image: OG_IMAGE_URL,
    isAccessibleForFree: true,
    countriesSupported: "IN",
    author: { "@id": `${SITE_URL}/#organization` },
    offers: jsonLdOffers(pageUrl),
    featureList: [
      "Student and batch management",
      "Attendance on phone",
      "Fee tracking and numbered receipts",
      "Staff invites",
      "Excel and CSV import",
    ],
  };
}

export function homeJsonLd() {
  const url = canonicalUrl("/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      webSiteJsonLd(),
      softwareApplicationJsonLd(url),
      faqJsonLd(LANDING_FAQS, url),
    ],
  };
}

export function pricingJsonLd() {
  const url = canonicalUrl("/pricing");
  return {
    "@context": "https://schema.org",
    "@graph": [softwareApplicationJsonLd(url), faqJsonLd(PRICING_FAQS, url)],
  };
}

export function stringifyJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
