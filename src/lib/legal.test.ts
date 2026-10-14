import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GST_STATUS,
  LEGAL_LAST_UPDATED,
  OPERATOR_NAME,
  PRODUCT_BUILDER_NAME,
  SUPABASE_REGION,
} from "./legal";
import { PUBLIC_PAGES } from "./seo";
import { Route as ContactRoute } from "@/routes/contact";
import { Route as PrivacyRoute } from "@/routes/privacy";
import { Route as RefundPolicyRoute } from "@/routes/refund-policy";
import { Route as TermsRoute } from "@/routes/terms";

const legalRouteFiles = [
  {
    file: "src/routes/privacy.tsx",
    path: "/privacy",
    title: "Privacy Policy",
    route: PrivacyRoute,
  },
  {
    file: "src/routes/terms.tsx",
    path: "/terms",
    title: "Terms of Service",
    route: TermsRoute,
  },
  {
    file: "src/routes/refund-policy.tsx",
    path: "/refund-policy",
    title: "Refunds & cancellations",
    route: RefundPolicyRoute,
  },
  {
    file: "src/routes/contact.tsx",
    path: "/contact",
    title: "Contact",
    route: ContactRoute,
  },
] as const;

const legalCopyFiles = [
  "src/lib/legal.ts",
  "src/components/public/legal-page.tsx",
  ...legalRouteFiles.map((p) => p.file),
];

describe("legal config", () => {
  it("does not keep a postal address, placeholder, or location", () => {
    for (const file of legalCopyFiles) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toContain("LEGAL_ADDRESS");
      expect(src).not.toContain("ADDRESS PENDING");
      expect(src.toLowerCase()).not.toContain("postal address");
      expect(src).not.toContain("Valanchery");
      expect(src).not.toContain("Malappuram");
    }
    expect(PUBLIC_PAGES.privacy.description).not.toMatch(
      /Valanchery|Malappuram/,
    );
    expect(PUBLIC_PAGES.terms.description).not.toMatch(/Valanchery|Malappuram/);
    expect(PUBLIC_PAGES.refundPolicy.description).not.toMatch(
      /Valanchery|Malappuram/,
    );
    expect(PUBLIC_PAGES.contact.description).not.toMatch(
      /Valanchery|Malappuram/,
    );
  });

  it("sets the operator, builder, GST line and last-updated date", () => {
    expect(OPERATOR_NAME).toBe("Jyothis K Aryan");
    expect(PRODUCT_BUILDER_NAME).toBe("Aryanand K Jyothis");
    expect(GST_STATUS).toBe("Not GST registered.");
    expect(LEGAL_LAST_UPDATED).toBe("13 October 2026");
    expect(SUPABASE_REGION).toBeNull();
  });
});

describe("legal routes render", () => {
  it("registers privacy, terms, refund-policy and contact with page components", () => {
    for (const page of legalRouteFiles) {
      expect(page.route.options.component).toEqual(expect.any(Function));
      const src = readFileSync(page.file, "utf8");
      expect(src).toContain(`createFileRoute("${page.path}")`);
      expect(src).toContain(`title="${page.title}"`);
      expect(src).toContain("LegalPageLayout");
      expect(src).toContain("LegalOperatorIntro");
    }
  });

  it("shows GST status and last-updated date on every legal page", () => {
    const layout = readFileSync("src/components/public/legal-page.tsx", "utf8");
    expect(layout).toContain("LEGAL_LAST_UPDATED");
    expect(layout).toContain("GST_STATUS");
    for (const page of legalRouteFiles) {
      const src = readFileSync(page.file, "utf8");
      expect(src).toContain("LegalOperatorIntro");
    }
  });
});
