import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LANDING_FAQS,
  PRICING_FAQS,
  landingFaqUsesDisplayPrices,
} from "./public-faqs";
import {
  APPROVED_PRICING,
  formatIndianPrice,
  jsonLdOffers,
} from "./pricing-display";
import {
  OG_IMAGE_URL,
  PUBLIC_PAGES,
  SITEMAP_PATHS,
  canonicalUrl,
  homeJsonLd,
  pageHead,
  pricingJsonLd,
  stringifyJsonLd,
} from "./seo";
import {
  AI_CRAWLERS,
  ROBOTS_DISALLOW,
  buildLlmsTxt,
  buildRobotsTxt,
  buildSitemapXml,
} from "./seo-documents";
import { SITE_URL } from "./site";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../../public");

describe("public page SEO", () => {
  it("gives every public page a unique title and description", () => {
    const pages = Object.values(PUBLIC_PAGES);
    const titles = pages.map((p) => p.title);
    const descriptions = pages.map((p) => p.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const page of pages) {
      expect(page.title).toContain("Vidya Orbit");
      expect(page.description.length).toBeGreaterThan(40);
      expect(page.description.length).toBeLessThan(220);
    }
  });

  it("puts the brand first on the home title and names Kerala", () => {
    expect(PUBLIC_PAGES.home.title.startsWith("Vidya Orbit")).toBe(true);
    expect(PUBLIC_PAGES.home.title.toLowerCase()).toContain("kerala");
    expect(PUBLIC_PAGES.home.description.toLowerCase()).toContain("valanchery");
    expect(PUBLIC_PAGES.home.description.toLowerCase()).toContain("malappuram");
  });

  it("emits canonical, OG and Twitter tags pointing at www", () => {
    const head = pageHead(PUBLIC_PAGES.pricing);
    expect(head.links).toEqual([
      { rel: "canonical", href: "https://www.vidyaorbit.in/pricing" },
    ]);
    const keys = head.meta.map((m) => ("property" in m ? m.property : m.name));
    expect(keys).toEqual(
      expect.arrayContaining([
        "description",
        "og:title",
        "og:description",
        "og:url",
        "og:image",
        "og:site_name",
        "twitter:card",
        "twitter:title",
        "twitter:image",
      ]),
    );
    expect(
      head.meta.find((m) => "property" in m && m.property === "og:image")
        ?.content,
    ).toBe(OG_IMAGE_URL);
    expect(canonicalUrl("/")).toBe(`${SITE_URL}/`);
  });

  it("noindexes invite and password-reset pages", () => {
    expect(PUBLIC_PAGES.join.noindex).toBe(true);
    expect(PUBLIC_PAGES.forgotPassword.noindex).toBe(true);
    expect(PUBLIC_PAGES.resetPassword.noindex).toBe(true);
    const robots = pageHead(PUBLIC_PAGES.join).meta.find(
      (m) => "name" in m && m.name === "robots",
    );
    expect(robots?.content).toBe("noindex, nofollow");
    expect(
      pageHead(PUBLIC_PAGES.home).meta.find(
        (m) => "name" in m && m.name === "robots",
      ),
    ).toBeUndefined();
  });
});

describe("JSON-LD", () => {
  it("describes Organization, WebSite, SoftwareApplication and FAQPage on home", () => {
    const graph = homeJsonLd()["@graph"].map((n) => n["@type"]);
    expect(graph).toEqual([
      "Organization",
      "WebSite",
      "SoftwareApplication",
      "FAQPage",
    ]);
    const app = homeJsonLd()["@graph"].find(
      (n) => n["@type"] === "SoftwareApplication",
    ) as { applicationCategory: string; offers: unknown[] };
    expect(app.applicationCategory).toBe("BusinessApplication");
    expect(app.offers.length).toBeGreaterThan(0);
  });

  it("uses current display prices in INR and does not invent ratings", () => {
    const blob =
      stringifyJsonLd(homeJsonLd()) + stringifyJsonLd(pricingJsonLd());
    expect(blob).not.toMatch(/aggregateRating|ratingValue|"review"/i);
    const offers = jsonLdOffers(`${SITE_URL}/pricing`);
    for (const plan of APPROVED_PRICING) {
      expect(
        offers.some(
          (o) => o.price === plan.monthlyPrice && o.priceCurrency === "INR",
        ),
      ).toBe(true);
    }
    expect(landingFaqUsesDisplayPrices()).toBe(true);
  });

  it("FAQPage questions match the on-page landing FAQ", () => {
    const faq = homeJsonLd()["@graph"].find(
      (n) => n["@type"] === "FAQPage",
    ) as {
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(
      LANDING_FAQS.map((f) => f.q),
    );
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(
      LANDING_FAQS.map((f) => f.a),
    );
    expect(LANDING_FAQS.length).toBeGreaterThanOrEqual(5);
    expect(LANDING_FAQS.length).toBeLessThanOrEqual(7);
  });

  it("pricing FAQPage matches the pricing page FAQ", () => {
    const faq = pricingJsonLd()["@graph"].find(
      (n) => n["@type"] === "FAQPage",
    ) as {
      mainEntity: { name: string }[];
    };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(
      PRICING_FAQS.map((f) => f.q),
    );
  });
});

describe("crawl documents", () => {
  it("allows named search and AI crawlers and blocks app/api paths", () => {
    const robots = buildRobotsTxt();
    for (const bot of AI_CRAWLERS) {
      expect(robots).toContain(`User-agent: ${bot}`);
    }
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    for (const path of ROBOTS_DISALLOW) {
      expect(robots).toContain(`Disallow: ${path}`);
    }
    expect(robots).not.toContain("Disallow: /login");
    expect(robots).not.toContain("Disallow: /pricing");
  });

  it("lists only public marketing pages in the sitemap", () => {
    const xml = buildSitemapXml();
    for (const path of SITEMAP_PATHS) {
      expect(xml).toContain(`<loc>${canonicalUrl(path)}</loc>`);
    }
    expect(xml).not.toContain("/dashboard");
    expect(xml).not.toContain("/api");
    expect(xml).not.toContain("/join");
    expect(xml).not.toContain("/forgot-password");
  });

  it("writes llms.txt from live pricing and contact defaults", () => {
    const txt = buildLlmsTxt();
    expect(txt).toContain("# Vidya Orbit");
    expect(txt.toLowerCase()).toContain("valanchery");
    expect(txt.toLowerCase()).toContain("malappuram");
    expect(txt).toContain("https://www.vidyaorbit.in/pricing");
    for (const plan of APPROVED_PRICING) {
      expect(txt).toContain(plan.displayName);
      expect(txt).toContain(formatIndianPrice(plan.monthlyPrice));
    }
    expect(txt.toLowerCase()).not.toContain("most popular");
  });

  it("keeps committed public files in sync with the builders", () => {
    expect(readFileSync(join(publicDir, "robots.txt"), "utf8")).toBe(
      buildRobotsTxt(),
    );
    expect(readFileSync(join(publicDir, "sitemap.xml"), "utf8")).toBe(
      buildSitemapXml(),
    );
    expect(readFileSync(join(publicDir, "llms.txt"), "utf8")).toBe(
      buildLlmsTxt(),
    );
  });
});
