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

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => pageHead(PUBLIC_PAGES.terms),
});

function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service">
      <LegalSection title="1. Acceptance of terms">
        <LegalOperatorIntro />
        <p className="mt-2">
          By creating an account or using Vidya Orbit ("the service"), you agree
          to these terms. If you do not agree, do not use the service.
        </p>
      </LegalSection>

      <LegalSection title="2. Who may use Vidya Orbit">
        <p>
          You must be 18 or older and authorised to act for the coaching or
          tuition centre whose account you create or use. If you invite staff,
          you confirm they are likewise authorised by the centre.
        </p>
      </LegalSection>

      <LegalSection title="3. The service">
        <p>
          Vidya Orbit is software for coaching centres and tuition institutes to
          manage students, batches, attendance, fees and receipts. We offer a
          Free plan and paid plans (Spark, Orbit and Centre). Paid plans unlock
          higher student limits and additional features. Current pricing is
          shown on the{" "}
          <Link to="/pricing" className="text-primary hover:underline">
            pricing page
          </Link>
          . Paid plans can be paid in the app on the Plan page through Razorpay
          (monthly or annual), or arranged with us.
        </p>
      </LegalSection>

      <LegalSection title="4. Your account">
        <p>
          You are responsible for keeping login credentials confidential and for
          activity under your account. Provide accurate information and tell us
          promptly of any unauthorised access.
        </p>
      </LegalSection>

      <LegalSection title="5. Centre obligations and data processing">
        <p>
          You retain ownership of student, batch, fee and other institute data
          you enter into Vidya Orbit. For that data, your centre is the Data
          Fiduciary and Vidya Orbit is the Data Processor, as described in our{" "}
          <Link to="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <p className="mt-2">The centre must:</p>
        <ul className="ml-4 mt-2 list-disc space-y-1">
          <li>
            obtain verifiable parental consent before storing a child's personal
            data in Vidya Orbit;
          </li>
          <li>
            handle Data Principal requests (access, correction, erasure,
            grievance, nomination) for student and parent data, and tell us when
            you need our help as processor;
          </li>
          <li>
            use the service only for the centre's own operations and in line
            with applicable law, including the Digital Personal Data Protection
            Act, 2023.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <p>
          You agree not to misuse Vidya Orbit, including by attempting
          unauthorised access, uploading malicious content, bypassing billing or
          plan limits, or using the platform for any illegal purpose.
        </p>
      </LegalSection>

      <LegalSection title="7. Fees, price changes and refunds">
        <p>
          We may change prices. We will give at least 30 days' notice before a
          change applies to you. The{" "}
          <Link to="/refund-policy" className="text-primary hover:underline">
            refund policy
          </Link>{" "}
          explains one-time Razorpay payments, cancellations, the setup fee, and
          when a refund is given.
        </p>
      </LegalSection>

      <LegalSection title="8. Availability and liability">
        <p>
          Vidya Orbit is provided "as is" without warranty of any kind. We do
          not guarantee uninterrupted availability. We recommend you keep your
          own backups of critical information.
        </p>
        <p className="mt-2">
          To the extent permitted by law, our total liability arising out of or
          in connection with Vidya Orbit is capped at the fees you paid us in
          the 12 months before the claim.
        </p>
      </LegalSection>

      <LegalSection title="9. Termination">
        <p>
          You may stop using the service at any time. Email us to cancel a paid
          plan; access continues to the end of the paid period, as set out in
          the{" "}
          <Link to="/refund-policy" className="text-primary hover:underline">
            refund policy
          </Link>
          . We may suspend or terminate accounts that violate these terms or
          that are used to harm other users or the platform.
        </p>
      </LegalSection>

      <LegalSection title="10. Governing law">
        <p>
          These terms are governed by the laws of India. Courts in Kerala have
          exclusive jurisdiction over disputes.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          We may update these terms from time to time. Continued use of Vidya
          Orbit after changes constitutes acceptance of the new terms.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>For questions about these terms:</p>
        <ul className="ml-4 mt-2 list-disc">
          <li>{GRIEVANCE_OFFICER_NAME}</li>
          <li>
            Email:{" "}
            <a
              className="text-primary hover:underline"
              href={`mailto:${GRIEVANCE_OFFICER_EMAIL}`}
            >
              {GRIEVANCE_OFFICER_EMAIL}
            </a>
          </li>
          <li>Phone: {GRIEVANCE_OFFICER_PHONE}</li>
        </ul>
      </LegalSection>
    </LegalPageLayout>
  );
}
