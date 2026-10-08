import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Vidya" },
      {
        name: "description",
        content: "Privacy policy describing how Vidya handles your data.",
      },
    ],
  }),
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link
        to="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to home
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: 26 May 2026
      </p>

      <div className="mt-8 space-y-6">
        <Section title="1. Who we are">
          <p>
            Vidya is an institute management platform operated by Aryanand K
            Jyothis from Kerala, India. We can be reached at{" "}
            <a
              className="text-primary hover:underline"
              href="mailto:aryanandkjyothis4@gmail.com"
            >
              aryanandkjyothis4@gmail.com
            </a>{" "}
            or +91 7025063047.
          </p>
        </Section>

        <Section title="2. Information we collect">
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Account data:</strong> name, email, and authentication
              identifiers when you sign up.
            </li>
            <li>
              <strong>Institute data:</strong> information you enter about your
              institute, students, batches, attendance, fees and payments.
            </li>
            <li>
              <strong>Usage data:</strong> basic technical logs (IP, browser,
              timestamps) used to operate and secure the service.
            </li>
          </ul>
        </Section>

        <Section title="3. How we use your data">
          <ul className="ml-4 list-disc space-y-1">
            <li>To provide and maintain the service.</li>
            <li>To authenticate you and secure your account.</li>
            <li>To respond to support requests.</li>
            <li>To improve the platform.</li>
          </ul>
          <p className="mt-2">
            We do not sell your data, and we do not use student data for
            advertising.
          </p>
        </Section>

        <Section title="4. Where data is stored">
          <p>
            Your data is stored on managed cloud infrastructure with
            industry-standard security, access controls and encryption in
            transit. Each institute's data is isolated by row-level security so
            only you can access your records.
          </p>
        </Section>

        <Section title="5. Sharing">
          <p>
            We share data only with infrastructure providers strictly needed to
            run the service (hosting, database, authentication). We do not share
            your institute or student data with third parties for any other
            purpose.
          </p>
        </Section>

        <Section title="6. Payments">
          <p>
            Paid subscriptions are arranged by contacting us directly. In the
            future, we plan to add online payment processing through{" "}
            <strong>Razorpay</strong>. If and when you upgrade via an online
            checkout, you'll enter your card / UPI / netbanking details directly
            with Razorpay — we never see or store your card or bank credentials.
            We store only the subscription details and billing status to grant
            the right level of access. Razorpay's own privacy policy would apply
            to data you submit to their checkout.
          </p>
        </Section>

        <Section title="7. Your rights">
          <p>
            You can view and edit your data at any time inside the app. To
            export or permanently delete your account data, email us at{" "}
            <a
              className="text-primary hover:underline"
              href="mailto:aryanandkjyothis4@gmail.com"
            >
              aryanandkjyothis4@gmail.com
            </a>{" "}
            and we will respond within a reasonable time.
          </p>
        </Section>

        <Section title="8. Children's data">
          <p>
            Vidya stores student information on behalf of the institute that
            uses it. The institute is responsible for collecting required
            parental consent. We do not knowingly contact students directly or
            send them marketing.
          </p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>
            We may update this policy from time to time. Material changes will
            be notified in-app or by email.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>Questions or requests:</p>
          <ul className="ml-4 list-disc">
            <li>Aryanand K Jyothis</li>
            <li>
              Email:{" "}
              <a
                className="text-primary hover:underline"
                href="mailto:aryanandkjyothis4@gmail.com"
              >
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
