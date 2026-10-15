import { describe, expect, it } from "vitest";
import { LANDING_FAQS } from "./public-faqs";
import {
  BANNED_LANDING_PHRASES,
  CTA_BOOK_DEMO,
  CTA_GO_TO_DASHBOARD,
  CTA_LOG_IN,
  CTA_START_FREE,
  FOUNDER_LINE,
  HERO_EYEBROW,
  HERO_MALAYALAM,
  HERO_SUB,
  HERO_TITLE,
  LANDING_CLAIMS,
  LANDING_DESCRIPTION,
  LANDING_TITLE,
  landingLoginCta,
  landingSignupCta,
  marketingHomePath,
} from "./landing-copy";
import { SITE_URL } from "./site";

function haystack() {
  return [
    LANDING_TITLE,
    HERO_TITLE,
    HERO_SUB,
    HERO_MALAYALAM,
    FOUNDER_LINE,
    LANDING_DESCRIPTION,
    ...LANDING_CLAIMS.map((c) => c.text),
    ...LANDING_FAQS.map((f) => `${f.q} ${f.a}`),
  ]
    .join("\n")
    .toLowerCase();
}

describe("landing copy", () => {
  it("speaks to centre owners, not students", () => {
    expect(HERO_TITLE.toLowerCase()).toContain("who still owes");
    expect(HERO_SUB.toLowerCase()).toContain("owners");
    expect(HERO_SUB.toLowerCase()).toContain("attendance");
    expect(HERO_SUB.toLowerCase()).toContain("staff");
    expect(HERO_SUB.toLowerCase()).not.toContain("paste");
    expect(HERO_EYEBROW.toLowerCase()).toContain("owners");
    expect(HERO_EYEBROW.toLowerCase()).toContain("kerala");
  });

  it("uses owner CTAs", () => {
    expect(CTA_BOOK_DEMO).toBe("Book a free demo");
    expect(CTA_START_FREE).toBe("Start free");
    expect(CTA_LOG_IN).toBe("Log in");
    expect(CTA_GO_TO_DASHBOARD).toBe("Go to dashboard");
  });

  it("swaps Start free and Log in for Go to dashboard when signed in", () => {
    expect(landingSignupCta(false)).toEqual({
      to: "/login",
      label: CTA_START_FREE,
      search: { mode: "signup" },
    });
    expect(landingSignupCta(true)).toEqual({
      to: "/dashboard",
      label: CTA_GO_TO_DASHBOARD,
    });
    expect(landingLoginCta(false)).toEqual({
      to: "/login",
      label: CTA_LOG_IN,
    });
    expect(landingLoginCta(true)).toEqual({
      to: "/dashboard",
      label: CTA_GO_TO_DASHBOARD,
    });
  });

  it("keeps in-page landing links on /home", () => {
    expect(marketingHomePath("/home")).toBe("/home");
    expect(marketingHomePath("/")).toBe("/");
    expect(marketingHomePath("/pricing")).toBe("/");
  });

  it("keeps a Malayalam line for native-speaker review", () => {
    expect(HERO_MALAYALAM.length).toBeGreaterThan(10);
    expect(HERO_MALAYALAM).toMatch(/ഒരുക്കിത്തരാം/);
  });

  it("keeps the founder line", () => {
    expect(FOUNDER_LINE).toContain("Aryanand");
    expect(FOUNDER_LINE).toContain("Valanchery");
  });

  it("titles the brand first", () => {
    expect(LANDING_TITLE.startsWith("Vidya Orbit")).toBe(true);
  });

  it("avoids known false or fake-social phrases", () => {
    const blob = haystack();
    for (const phrase of BANNED_LANDING_PHRASES) {
      expect(blob).not.toContain(phrase);
    }
  });

  it("canonicalises to www", () => {
    expect(SITE_URL).toBe("https://www.vidyaorbit.in");
  });

  it("documents backing sources for every claim", () => {
    expect(LANDING_CLAIMS.length).toBeGreaterThan(5);
    for (const claim of LANDING_CLAIMS) {
      expect(claim.source.length).toBeGreaterThan(8);
    }
  });
});
