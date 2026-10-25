import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOOGLE_LIMITED_USE_SENTENCE } from "./legal";

function src(path: string) {
  return readFileSync(path, "utf8").replace(/\s+/g, " ");
}

describe("privacy policy copy", () => {
  const privacy = src("src/routes/privacy.tsx");

  it("states DPDP roles for the centre and Vidya Orbit", () => {
    expect(privacy).toMatch(/Data Fiduciary/);
    expect(privacy).toMatch(/Data\s+Processor/);
    expect(privacy).toMatch(/student and parent/i);
    expect(privacy).toContain("owner and staff account data");
    expect(privacy).toContain("billing data");
    expect(privacy).toContain("marketing data");
  });

  it("discloses Google sign-in Limited Use and marketing opt-in", () => {
    expect(privacy).toContain("GOOGLE_LIMITED_USE_SENTENCE");
    expect(GOOGLE_LIMITED_USE_SENTENCE).toMatch(/Limited Use requirements/);
    expect(privacy).toContain("name, email address and profile picture");
    expect(privacy).toContain("unticked by default");
    expect(privacy).toContain("wa.me");
    expect(privacy).toContain("Vidya Orbit does not message parents");
  });

  it("covers processors, retention, rights, children and grievance timelines", () => {
    expect(privacy).toContain("may be stored outside India");
    expect(privacy).toContain("section 16");
    expect(privacy).toContain("within 30 days");
    expect(privacy).toContain("within 90 days");
    expect(privacy).toContain("8 years");
    expect(privacy).toContain("verifiable parental consent");
    expect(privacy).toContain("Data Protection Board of India");
    expect(privacy).toContain("Supabase session");
  });
});

describe("terms of service copy", () => {
  const terms = src("src/routes/terms.tsx");

  it("uses Vidya Orbit consistently and links the refund policy", () => {
    expect(terms).toContain("Vidya Orbit");
    expect(terms).not.toMatch(/using Vidya \(/);
    expect(terms).toContain('to="/refund-policy"');
    expect(terms).toContain("18 or older");
    expect(terms).toContain("30 days' notice");
    expect(terms).toContain("fees you paid us in the 12 months");
    expect(terms).toContain("Courts in Kerala");
    expect(terms).not.toContain("not liable for any loss of data");
  });
});

describe("refund policy copy", () => {
  const refund = src("src/routes/refund-policy.tsx");

  it("describes one-time Razorpay payments and the listed refund exceptions", () => {
    expect(refund).toContain("one-time Razorpay payments");
    expect(refund).toContain("no auto-debit and no auto-renewal");
    expect(refund).toContain("duplicate or erroneous charges");
    expect(refund).toContain("setup fee charged when one was already paid");
    expect(refund).toContain("plan that wasn't activated");
    expect(refund).toContain("5–7 business");
    expect(refund).toContain("₹5,000 setup fee");
    expect(refund).toContain("Shipping and delivery are not applicable");
  });
});

describe("public share privacy notice", () => {
  it("links the privacy policy from the public share page and messaging settings", () => {
    const shell = src("src/components/public/share-page-shell.tsx");
    expect(shell).toContain("does not use it for ads or profiling");
    expect(shell).toContain('to="/privacy"');
    const settings = src("src/routes/_authenticated/settings.index.tsx");
    expect(settings).toContain("Public receipt links expire after 180 days");
    expect(settings).toContain('to="/privacy"');
  });

  it("does not mention expiry on the public not-found page", () => {
    const page = src("src/routes/r.$token.tsx");
    expect(page).toContain("Receipt not found");
    expect(page).not.toMatch(/was expired|expired link|this receipt expired/i);
  });
});

describe("legal footer links", () => {
  it("lists Privacy, Terms, Refunds & cancellations and Contact", () => {
    const footer = src("src/components/public/site-footer.tsx");
    expect(footer).toContain('to="/privacy"');
    expect(footer).toContain('to="/terms"');
    expect(footer).toContain('to="/refund-policy"');
    expect(footer).toContain('to="/contact"');
    expect(footer).not.toContain('hash="refund"');
  });
});
