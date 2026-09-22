import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — Vidya" },
      {
        name: "description",
        content: "Terms of service for the Vidya institute management platform.",
      },
    ],
  }),
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to home
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 26 May 2026</p>

      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-foreground">
        <Section title="1. Acceptance of terms">
          <p>
            By creating an account or using Vidya ("the service"), you agree to be bound by these
            terms. If you do not agree, please do not use the service.
          </p>
        </Section>

        <Section title="2. The service">
          <p>
            Vidya is a software platform for coaching centres and tuition institutes to manage
            students, batches, attendance, fees and receipts. A free tier is available with usage
            limits. Paid plans (Starter, Growth and Pro) unlock higher student limits and additional
            features. Current pricing is shown on the in-app Billing page and may change with
            reasonable notice.
          </p>
        </Section>

        <Section title="3. Your account">
          <p>
            You are responsible for maintaining the confidentiality of your login credentials and
            for all activity that occurs under your account. You must provide accurate information
            and notify us promptly of any unauthorised access.
          </p>
        </Section>

        <Section title="4. Your data">
          <p>
            You retain ownership of all student, batch, fee and other institute data you enter into
            Vidya. You are responsible for ensuring you have the right to store that data, for
            complying with applicable data protection laws, and for obtaining consent from students
            or guardians where required.
          </p>
        </Section>

        <Section title="5. Acceptable use">
          <p>
            You agree not to misuse the service, including by attempting to gain unauthorised
            access, uploading malicious content, attempting to bypass billing or plan limits, or
            using the platform for any illegal purpose.
          </p>
        </Section>

        <Section title="6. Paid subscriptions, billing and refunds">
          <p>
            Paid plans are billed monthly in Indian Rupees (INR) through Razorpay. Your subscription
            renews automatically until you cancel. You can cancel at any time from the Billing page;
            cancellation takes effect at the end of the current billing period and you retain access
            until then. Because the service is delivered digitally and immediately on payment, fees
            already paid are non-refundable except where required by law. If your subscription
            lapses or is cancelled, your account automatically reverts to the Free tier and data
            beyond the Free-tier limits remains stored but read-only until you upgrade again.
          </p>
        </Section>

        <Section title="7. Donations">
          <p>
            Donations made through the "Support us" page are voluntary and non-refundable. Donations
            do not entitle you to any additional features or services.
          </p>
        </Section>

        <Section title="8. Availability and warranty">
          <p>
            The service is provided "as is" without warranty of any kind. We do not guarantee
            uninterrupted availability and are not liable for any loss of data or business arising
            from use of the service. We recommend you keep your own backups of critical information.
          </p>
        </Section>

        <Section title="9. Termination">
          <p>
            You may stop using the service at any time. We may suspend or terminate accounts that
            violate these terms or that are used to harm other users or the platform. Paid
            subscriptions cancelled by us for violation of these terms are non-refundable.
          </p>
        </Section>

        <Section title="10. Changes">
          <p>
            We may update these terms from time to time. Continued use of the service after changes
            constitutes acceptance of the new terms.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>For any questions about these terms, contact:</p>
          <ul className="ml-4 list-disc">
            <li>Aryanand K Jyothis</li>
            <li>
              Email:{" "}
              <a className="text-primary hover:underline" href="mailto:aryanandkjyothis4@gmail.com">
                aryanandkjyothis4@gmail.com
              </a>
            </li>
            <li>Phone: +91 7025063047</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
