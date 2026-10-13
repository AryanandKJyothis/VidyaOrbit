import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LegalOperatorIntro,
  LegalPageLayout,
  LegalPostalAddress,
  LegalSection,
} from "@/components/public/legal-page";
import {
  GOOGLE_LIMITED_USE_POLICY_URL,
  GOOGLE_LIMITED_USE_SENTENCE,
  GRIEVANCE_OFFICER_EMAIL,
  GRIEVANCE_OFFICER_NAME,
  GRIEVANCE_OFFICER_PHONE,
  SUPABASE_REGION,
} from "@/lib/legal";
import { MARKETING_OPT_IN_LABEL } from "@/lib/marketing-opt-in";
import { PUBLIC_PAGES, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => pageHead(PUBLIC_PAGES.privacy),
});

function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <LegalSection title="1. Who we are">
        <LegalOperatorIntro />
        <p className="mt-2">
          Questions about this policy:{" "}
          <a
            className="text-primary hover:underline"
            href={`mailto:${GRIEVANCE_OFFICER_EMAIL}`}
          >
            {GRIEVANCE_OFFICER_EMAIL}
          </a>{" "}
          or {GRIEVANCE_OFFICER_PHONE}.
        </p>
      </LegalSection>

      <LegalSection title="2. Roles under the Digital Personal Data Protection Act, 2023">
        <p>
          For student and parent or guardian personal data that a coaching or
          tuition centre enters into Vidya Orbit, the centre is the Data
          Fiduciary. Vidya Orbit is the centre's Data Processor, acting on the
          centre's instructions.
        </p>
        <p className="mt-2">
          Vidya Orbit is the Data Fiduciary for owner and staff account data,
          billing data, and marketing data.
        </p>
      </LegalSection>

      <LegalSection title="3. Information we collect">
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong className="text-foreground">Student and parent data</strong>{" "}
            (processed for the centre): student names, batch, attendance, fee
            records, and parent or guardian names and phones.
          </li>
          <li>
            <strong className="text-foreground">Account data</strong> (Vidya
            Orbit as Data Fiduciary): account email, name and phone.
          </li>
          <li>
            <strong className="text-foreground">Marketing data:</strong> whether
            you opted in to product emails, and the timestamp of that choice.
          </li>
          <li>
            <strong className="text-foreground">Billing data:</strong> Razorpay
            order and payment IDs, plan and billing status. You enter card, UPI
            or netbanking details on Razorpay's checkout — we never see or store
            those credentials.
          </li>
          <li>
            <strong className="text-foreground">Technical logs:</strong> IP
            address, browser and timestamps used to operate and secure the
            service.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Google sign-in">
        <p>
          If you sign in with Google, we receive your name, email address and
          profile picture. We use these only for authentication. We do not use
          them for advertising, and we do not sell them.
        </p>
        <p className="mt-2">
          {GOOGLE_LIMITED_USE_SENTENCE} See the{" "}
          <a
            className="text-primary hover:underline"
            href={GOOGLE_LIMITED_USE_POLICY_URL}
            target="_blank"
            rel="noreferrer"
          >
            Google API Services User Data Policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="5. Marketing emails">
        <p>
          Product updates and tips are optional. The checkbox labelled "
          {MARKETING_OPT_IN_LABEL}" is unticked by default. If you tick it, we
          store your consent and the timestamp.
        </p>
        <p className="mt-2">
          You can withdraw that consent as easily as you gave it: email{" "}
          <a
            className="text-primary hover:underline"
            href={`mailto:${GRIEVANCE_OFFICER_EMAIL}`}
          >
            {GRIEVANCE_OFFICER_EMAIL}
          </a>
          . We will record the withdrawal with a timestamp and stop marketing
          emails. Account and billing messages are not marketing.
        </p>
      </LegalSection>

      <LegalSection title="6. WhatsApp fee reminders and receipts">
        <p>
          WhatsApp fee reminders and receipts are{" "}
          <code className="text-foreground">wa.me</code> links the centre sends
          from its own WhatsApp. Vidya Orbit does not message parents itself.
        </p>
      </LegalSection>

      <LegalSection title="7. How we use personal data">
        <ul className="ml-4 list-disc space-y-1">
          <li>
            To provide and maintain the service for the centre that holds the
            account.
          </li>
          <li>To authenticate you and secure your account.</li>
          <li>To process one-time plan payments through Razorpay.</li>
          <li>To send marketing emails only if you opted in.</li>
          <li>To respond to support and grievance requests.</li>
        </ul>
        <p className="mt-2">
          We do not sell personal data. We do not use student data for ads.
        </p>
      </LegalSection>

      <LegalSection title="8. Processors and transfers outside India">
        <p>We use these processors to run Vidya Orbit:</p>
        <ul className="ml-4 mt-2 list-disc space-y-1">
          <li>
            <strong className="text-foreground">Supabase</strong> — database and
            authentication.
            {SUPABASE_REGION ? (
              <> Hosted in {SUPABASE_REGION}.</>
            ) : (
              <>
                {" "}
                The project region is not recorded in this application's config,
                so personal data may be stored outside India.
              </>
            )}
          </li>
          <li>
            <strong className="text-foreground">Vercel</strong> — application
            hosting.
          </li>
          <li>
            <strong className="text-foreground">Google</strong> — optional
            Google sign-in.
          </li>
          <li>
            <strong className="text-foreground">Razorpay</strong> — checkout and
            payment processing. Razorpay's privacy policy applies to data you
            submit on their checkout.
          </li>
        </ul>
        <p className="mt-2">
          Where personal data is transferred outside India, we do so in line
          with section 16 of the Digital Personal Data Protection Act, 2023.
        </p>
      </LegalSection>

      <LegalSection title="9. Retention">
        <ul className="ml-4 list-disc space-y-1">
          <li>
            After a valid erasure request, we delete the relevant personal data
            within 30 days.
          </li>
          <li>Copies in backups are removed within 90 days.</li>
          <li>Billing records are kept for 8 years.</li>
        </ul>
      </LegalSection>

      <LegalSection title="10. Your rights">
        <p>
          Data Principals may request access, correction, erasure, grievance
          redressal, and nomination of another person to exercise these rights
          in case of death or incapacity. Withdrawing consent is as easy as
          giving it.
        </p>
        <p className="mt-2">
          You can view and edit much of your data in the app. For access,
          correction, erasure or nomination, email{" "}
          <a
            className="text-primary hover:underline"
            href={`mailto:${GRIEVANCE_OFFICER_EMAIL}`}
          >
            {GRIEVANCE_OFFICER_EMAIL}
          </a>
          . Student and parent requests should go to the centre first; we will
          help the centre fulfil them.
        </p>
      </LegalSection>

      <LegalSection title="11. Security">
        <p>
          We follow reasonable security practices and procedures under rule 8 of
          the Information Technology (Reasonable Security Practices and
          Procedures and Sensitive Personal Data or Information) Rules, 2011.
          Passwords are hashed. Each centre's records are isolated by row-level
          security. Data is encrypted in transit.
        </p>
        <p className="mt-2">
          If a personal data breach is likely to affect you, we will notify you
          and the Data Protection Board of India as required by law.
        </p>
      </LegalSection>

      <LegalSection title="12. Children">
        <p>
          Centres must obtain verifiable parental consent before storing a
          child's personal data in Vidya Orbit. We do not track, profile, or
          show targeted ads to children, and we do not contact students for
          marketing.
        </p>
      </LegalSection>

      <LegalSection title="13. Cookies and local storage">
        <p>
          We use the browser's local storage to keep you signed in (the Supabase
          session). We do not use advertising cookies, and we do not use cookies
          or local storage to track children.
        </p>
      </LegalSection>

      <LegalSection title="14. Grievance officer">
        <p>
          Grievance Officer: {GRIEVANCE_OFFICER_NAME}. Email:{" "}
          <a
            className="text-primary hover:underline"
            href={`mailto:${GRIEVANCE_OFFICER_EMAIL}`}
          >
            {GRIEVANCE_OFFICER_EMAIL}
          </a>
          . Phone: {GRIEVANCE_OFFICER_PHONE}. <LegalPostalAddress labeled />
        </p>
        <p className="mt-2">
          We acknowledge grievances within 24 hours and resolve them within 30
          days. If you are not satisfied, you may approach the Data Protection
          Board of India.
        </p>
      </LegalSection>

      <LegalSection title="15. Changes">
        <p>
          We may update this policy from time to time. The date at the top will
          change. Material changes will be notified in-app or by email.
        </p>
      </LegalSection>

      <LegalSection title="16. Contact">
        <p>
          See our{" "}
          <Link to="/contact" className="text-primary hover:underline">
            contact page
          </Link>{" "}
          for operator, email, phone, postal address and grievance officer
          details.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
