import { describe, expect, it } from "vitest";
import { LANDING_FAQS } from "./public-faqs";
import {
  BANNED_LANDING_PHRASES,
  CTA_BOOK_DEMO,
  CTA_BOOK_SETUP_CALL,
  CTA_GO_TO_DASHBOARD,
  CTA_LOG_IN,
  CTA_GET_SPARK,
  CTA_START_FREE,
  FOUNDER_LINE,
  HERO_TRUST_LINE,
  HERO_EYEBROW,
  HERO_MALAYALAM,
  HERO_SCREENSHOT,
  HERO_SUB,
  HERO_TITLE,
  LANDING_CLAIMS,
  LANDING_DESCRIPTION,
  LANDING_TITLE,
  OFFLINE_LINE,
  RAZORPAY_LIVE_LINE,
  STARTER_ROI_LINE,
  WHATSAPP_SHARE_LINE,
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
    OFFLINE_LINE,
    STARTER_ROI_LINE,
    RAZORPAY_LIVE_LINE,
    WHATSAPP_SHARE_LINE,
    HERO_TRUST_LINE,
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
    expect(CTA_BOOK_SETUP_CALL).toBe("Book a free setup call");
    expect(CTA_START_FREE).toBe("Start free");
    expect(CTA_GET_SPARK).toBe("Get Spark");
    expect(HERO_TRUST_LINE.toLowerCase()).toContain("no card");
    expect(HERO_TRUST_LINE.toLowerCase()).toContain("assisted whatsapp");
    expect(HERO_TRUST_LINE.toLowerCase()).toContain("cancel anytime");
    expect(CTA_LOG_IN).toBe("Log in");
    expect(CTA_GO_TO_DASHBOARD).toBe("Go to dashboard");
  });

  it("contrasts paper registers and chat threads", () => {
    expect(OFFLINE_LINE.toLowerCase()).toContain("lost registers");
    expect(OFFLINE_LINE.toLowerCase()).toContain("chat threads");
  });

  it("frames WhatsApp as assisted send from the centre phone", () => {
    expect(WHATSAPP_SHARE_LINE.toLowerCase()).toContain("whatsapp");
    expect(WHATSAPP_SHARE_LINE.toLowerCase()).toContain("assisted");
    expect(WHATSAPP_SHARE_LINE.toLowerCase()).toContain("own phone");
    expect(WHATSAPP_SHARE_LINE.toLowerCase()).toContain(
      "never messages parents by itself",
    );
    expect(WHATSAPP_SHARE_LINE.toLowerCase()).toContain(
      "parents install nothing",
    );
    expect(WHATSAPP_SHARE_LINE.toLowerCase()).toContain("report card");
    expect(WHATSAPP_SHARE_LINE.toLowerCase()).toContain("absentee");
    expect(WHATSAPP_SHARE_LINE.toLowerCase()).not.toContain("auto-message");
    expect(WHATSAPP_SHARE_LINE.toLowerCase()).not.toContain("auto-send");
    expect(WHATSAPP_SHARE_LINE.toLowerCase()).not.toContain("cloud api");
  });

  it("nudges Starter with a missed-fee ROI line", () => {
    expect(STARTER_ROI_LINE.toLowerCase()).toContain("one missed fee");
    expect(RAZORPAY_LIVE_LINE.toLowerCase()).toContain("upi or cards");
    expect(RAZORPAY_LIVE_LINE.toLowerCase()).toContain("razorpay");
  });

  it("uses a real product WebP in the hero", () => {
    expect(HERO_SCREENSHOT.src).toMatch(/\.webp$/);
    expect(HERO_SCREENSHOT.src).toContain("/landing/");
    expect(HERO_SCREENSHOT.alt.toLowerCase()).toContain("attendance");
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
    expect(LANDING_TITLE.toLowerCase()).toContain("tuition");
    expect(LANDING_TITLE.toLowerCase()).toContain("coaching");
    expect(LANDING_TITLE.toLowerCase()).toContain("management software");
    expect(LANDING_TITLE.toLowerCase()).toContain("kerala");
    expect(LANDING_DESCRIPTION.toLowerCase()).toContain("management software");
    expect(LANDING_DESCRIPTION.toLowerCase()).toContain("malappuram");
    expect(LANDING_DESCRIPTION.toLowerCase()).toContain("valanchery");
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
