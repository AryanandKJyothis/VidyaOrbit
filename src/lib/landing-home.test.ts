import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Route as HomeRoute } from "@/routes/home";
import { Route as IndexRoute } from "@/routes/index";
import {
  APP_WEBSITE_LABEL,
  CTA_BOOK_SETUP_CALL,
  CTA_GO_TO_DASHBOARD,
  HERO_SCREENSHOT,
  MARKETING_LANDING_PATH,
  OFFLINE_LINE,
  STARTER_ROI_LINE,
} from "./landing-copy";
import { PUBLIC_PAGES, canonicalUrl, pageHead } from "./seo";

const indexSrc = readFileSync("src/routes/index.tsx", "utf8");
const homeSrc = readFileSync("src/routes/home.tsx", "utf8");
const headerSrc = readFileSync("src/components/public/site-header.tsx", "utf8");
const footerSrc = readFileSync("src/components/public/site-footer.tsx", "utf8");
const landingSrc = readFileSync(
  "src/components/landing/landing-page.tsx",
  "utf8",
);
const pricingSrc = readFileSync(
  "src/components/landing/landing-pricing.tsx",
  "utf8",
);
const sidebarSrc = readFileSync("src/components/app-sidebar.tsx", "utf8");
const moreSrc = readFileSync("src/components/app/more-sheet.tsx", "utf8");
const appSrc = readFileSync("src/routes/_authenticated.tsx", "utf8");
const treeSrc = readFileSync("src/routeTree.gen.ts", "utf8");

describe("/home marketing landing", () => {
  it("registers /home as a file route", () => {
    expect(existsSync("src/routes/home.tsx")).toBe(true);
    expect(homeSrc).toContain('createFileRoute("/home")');
    expect(HomeRoute.options.component).toEqual(expect.any(Function));
    expect(treeSrc).toContain("from './routes/home'");
    expect(treeSrc).toContain("fullPath: '/home'");
  });

  it("reuses the landing page and never redirects signed-in users", () => {
    expect(homeSrc).toContain("LandingPage");
    expect(indexSrc).toContain("LandingPage");
    expect(homeSrc).not.toContain("Navigate");
    expect(homeSrc).not.toContain("useAuth");
    expect(indexSrc).toContain("useAuth");
    expect(indexSrc).toContain('<Navigate to="/dashboard" />');
    expect(IndexRoute.options.component).toEqual(expect.any(Function));
  });

  it("canonicalises /home to the public homepage", () => {
    expect(MARKETING_LANDING_PATH).toBe("/home");
    expect(canonicalUrl("/")).toBe("https://www.vidyaorbit.in/");
    const head = pageHead(PUBLIC_PAGES.home);
    expect(head.links).toEqual([
      { rel: "canonical", href: "https://www.vidyaorbit.in/" },
    ]);
    expect(homeSrc).toContain("pageHead(PUBLIC_PAGES.home");
    expect(homeSrc).toContain("homeJsonLd");
    const homeHead = HomeRoute.options.head;
    expect(homeHead).toEqual(expect.any(Function));
    if (typeof homeHead !== "function") return;
    const resolved = homeHead({} as never);
    const links = (resolved as { links?: { rel?: string; href?: string }[] })
      .links;
    expect(links).toEqual([
      { rel: "canonical", href: "https://www.vidyaorbit.in/" },
    ]);
  });

  it("uses Go to dashboard CTAs when the visitor is signed in", () => {
    expect(landingSrc).toContain("landingSignupCta");
    expect(pricingSrc).toContain("landingSignupCta");
    expect(headerSrc).toContain("landingSignupCta");
    expect(headerSrc).toContain("landingLoginCta");
    expect(footerSrc).toContain("landingSignupCta");
    expect(footerSrc).toContain("landingLoginCta");
    expect(CTA_GO_TO_DASHBOARD).toBe("Go to dashboard");
  });

  it("shows the product screenshot, setup call CTA and offline line", () => {
    expect(landingSrc).toContain("HERO_SCREENSHOT");
    expect(landingSrc).toContain("CTA_BOOK_SETUP_CALL");
    expect(landingSrc).toContain("OFFLINE_LINE");
    expect(pricingSrc).toContain("STARTER_ROI_LINE");
    expect(CTA_BOOK_SETUP_CALL).toBe("Book a free setup call");
    expect(HERO_SCREENSHOT.src.endsWith(".webp")).toBe(true);
    expect(OFFLINE_LINE.length).toBeGreaterThan(20);
    expect(STARTER_ROI_LINE.toLowerCase()).toContain("missed fee");
  });

  it("mounts a mobile WhatsApp chip that skips app routes", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    const fab = readFileSync(
      "src/components/public/sticky-whatsapp.tsx",
      "utf8",
    );
    expect(root).toContain("StickyWhatsApp");
    expect(fab).toContain("isAppShellPath");
    expect(fab).toContain("md:hidden");
    expect(fab).toContain("getWhatsAppHref");
    expect(fab).toContain("Chat on WhatsApp");
  });

  it("links to /home from the signed-in app menu and footer", () => {
    expect(APP_WEBSITE_LABEL).toBe("Website");
    expect(sidebarSrc).toContain('to="/home"');
    expect(sidebarSrc).toContain("APP_WEBSITE_LABEL");
    expect(moreSrc).toContain('to: "/home"');
    expect(moreSrc).toContain("APP_WEBSITE_LABEL");
    expect(appSrc).toContain('to="/home"');
    expect(appSrc).toContain("APP_WEBSITE_LABEL");
  });
});
