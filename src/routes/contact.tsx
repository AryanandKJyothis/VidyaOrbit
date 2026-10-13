import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LegalOperatorIntro,
  LegalPageLayout,
  LegalPostalAddress,
  LegalSection,
} from "@/components/public/legal-page";
import {
  GRIEVANCE_OFFICER_EMAIL,
  GRIEVANCE_OFFICER_NAME,
  GRIEVANCE_OFFICER_PHONE,
} from "@/lib/legal";
import { PUBLIC_PAGES, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => pageHead(PUBLIC_PAGES.contact),
});

function ContactPage() {
  return (
    <LegalPageLayout title="Contact">
      <LegalSection title="Operator">
        <LegalOperatorIntro />
      </LegalSection>

      <LegalSection title="Email">
        <p>
          <a
            className="text-primary hover:underline"
            href={`mailto:${GRIEVANCE_OFFICER_EMAIL}`}
          >
            {GRIEVANCE_OFFICER_EMAIL}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="Phone">
        <p>
          <a className="text-primary hover:underline" href="tel:+917025063047">
            {GRIEVANCE_OFFICER_PHONE}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="Postal address">
        <p>
          <LegalPostalAddress />
        </p>
      </LegalSection>

      <LegalSection title="Grievance officer">
        <ul className="ml-4 list-disc space-y-1">
          <li>Name: {GRIEVANCE_OFFICER_NAME}</li>
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
          <li>
            <LegalPostalAddress labeled />
          </li>
        </ul>
        <p className="mt-2">
          We acknowledge grievances within 24 hours and resolve them within 30
          days. Related pages:{" "}
          <Link to="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          ,{" "}
          <Link to="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
          ,{" "}
          <Link to="/refund-policy" className="text-primary hover:underline">
            Refunds &amp; cancellations
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
