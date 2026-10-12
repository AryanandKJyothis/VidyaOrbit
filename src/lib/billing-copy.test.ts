import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LANDING_CLAIMS } from "./landing-copy";
import { LANDING_FAQS, PRICING_FAQS } from "./public-faqs";
import { buildLlmsTxt } from "./seo-documents";

const publicCopyFiles = [
  "src/routes/pricing.tsx",
  "src/routes/terms.tsx",
  "src/routes/privacy.tsx",
  "src/routes/_authenticated/plan.tsx",
  "src/components/landing/landing-page.tsx",
  "src/lib/public-faqs.ts",
  "src/lib/seo-documents.ts",
  "public/llms.txt",
];

function haystack() {
  return [
    ...LANDING_CLAIMS.map((c) => c.text),
    ...LANDING_FAQS.map((f) => `${f.q} ${f.a}`),
    ...PRICING_FAQS.map((f) => `${f.q} ${f.a}`),
    buildLlmsTxt(),
    ...publicCopyFiles.map((file) => readFileSync(file, "utf8")),
  ]
    .join("\n")
    .toLowerCase();
}

describe("public billing copy (VO-060 / VO-061)", () => {
  it("does not say online payment is coming soon or not live", () => {
    const blob = haystack();
    expect(blob).not.toContain("coming soon");
    expect(blob).not.toContain("checkout is not live");
    expect(blob).not.toContain("plan to add online payment");
  });

  it("does not mention GST on product or public pages", () => {
    const blob = haystack();
    expect(blob).not.toMatch(/\bgst\b/);
  });

  it("says paid plans can be paid in the app through Razorpay", () => {
    const blob = haystack();
    expect(blob).toContain("razorpay");
    expect(blob).toContain("plan page");
    expect(
      PRICING_FAQS.find((f) => f.q === "How do I upgrade?")?.a.toLowerCase(),
    ).toContain("razorpay");
  });
});
