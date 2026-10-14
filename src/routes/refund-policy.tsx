import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LegalOperatorIntro,
  LegalPageLayout,
  LegalSection,
} from "@/components/public/legal-page";
import {
  GRIEVANCE_OFFICER_EMAIL,
  GRIEVANCE_OFFICER_NAME,
  GRIEVANCE_OFFICER_PHONE,
} from "@/lib/legal";
import { PUBLIC_PAGES, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/refund-policy")({
  component: RefundPolicyPage,
  head: () => pageHead(PUBLIC_PAGES.refundPolicy),
});

function RefundPolicyPage() {
  return (
    <LegalPageLayout title="Refunds & cancellations">
      <LegalSection title="1. Who we are">
        <LegalOperatorIntro />
      </LegalSection>

      <LegalSection title="2. How you pay">
        <p>
          Paid Vidya Orbit plans are paid as one-time Razorpay payments for a
          monthly or annual period. There is no auto-debit and no auto-renewal.
          You pay in the app on the Plan page through Razorpay, or arrange
          payment with us.
        </p>
      </LegalSection>

      <LegalSection title="3. When a refund is given">
        <p>
          Once a paid period has started, the fee for that period is
          non-refundable, except in these cases:
        </p>
        <ul className="ml-4 mt-2 list-disc space-y-1">
          <li>duplicate or erroneous charges;</li>
          <li>a setup fee charged when one was already paid;</li>
          <li>a plan that wasn't activated.</li>
        </ul>
        <p className="mt-2">
          Qualifying refunds are returned to the original payment method within
          5–7 business days.
        </p>
      </LegalSection>

      <LegalSection title="4. Setup fee">
        <p>
          The ₹5,000 setup fee on the first monthly Growth or Large payment is
          non-refundable after onboarding is delivered. It is waived on annual
          plans.
        </p>
      </LegalSection>

      <LegalSection title="5. How to cancel">
        <p>
          To cancel, email{" "}
          <a
            className="text-primary hover:underline"
            href={`mailto:${GRIEVANCE_OFFICER_EMAIL}`}
          >
            {GRIEVANCE_OFFICER_EMAIL}
          </a>
          . Access continues to the end of the paid period. After that, the
          account reverts to the Free plan; existing data stays accessible, and
          adding new students may pause until you upgrade again.
        </p>
      </LegalSection>

      <LegalSection title="6. Shipping and delivery">
        <p>
          Shipping and delivery are not applicable. Vidya Orbit is delivered
          online as software you use in a browser.
        </p>
      </LegalSection>

      <LegalSection title="7. Contact">
        <p>
          {GRIEVANCE_OFFICER_NAME}. Email:{" "}
          <a
            className="text-primary hover:underline"
            href={`mailto:${GRIEVANCE_OFFICER_EMAIL}`}
          >
            {GRIEVANCE_OFFICER_EMAIL}
          </a>
          . Phone: {GRIEVANCE_OFFICER_PHONE}. These terms sit alongside the{" "}
          <Link to="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
