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
  it("states the orbit promise for Kerala centres", () => {
    expect(HERO_TITLE.toLowerCase()).toContain("one clear orbit");
    expect(HERO_SUB.toLowerCase()).toContain("attendance");
    expect(HERO_SUB.toLowerCase()).toContain("kerala");
    expect(HERO_SUB.toLowerCase()).not.toContain("paste");
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
