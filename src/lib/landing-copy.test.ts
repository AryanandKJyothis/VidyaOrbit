import { describe, expect, it } from "vitest";
import { LANDING_FAQS } from "./public-faqs";
import {
  BANNED_LANDING_PHRASES,
  FOUNDER_LINE,
  HERO_MALAYALAM,
  HERO_SUB,
  HERO_TITLE,
  LANDING_CLAIMS,
  LANDING_DESCRIPTION,
  LANDING_TITLE,
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
  it("promises setup, not a DIY afternoon", () => {
    expect(HERO_TITLE.toLowerCase()).toContain("zero headache");
    expect(HERO_SUB.toLowerCase()).toContain("excel or csv");
    expect(HERO_SUB.toLowerCase()).toContain("30-minute training");
    expect(HERO_SUB.toLowerCase()).not.toContain("paste");
  });

  it("keeps a Malayalam line for native-speaker review", () => {
    expect(HERO_MALAYALAM).toContain("ഒരുക്കിത്തരാം");
    expect(HERO_MALAYALAM).toBe(
      "ഞങ്ങൾ എല്ലാം ഒരുക്കിത്തരാം — ഒരു തലവേദനയും വേണ്ട.",
    );
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
