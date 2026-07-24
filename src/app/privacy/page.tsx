import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Northstar",
  description: "How Northstar collects, uses, and protects your data.",
};

const UPDATED = "July 23, 2026";
const CONTACT_EMAIL = "rajat@valnee.com";
const COMPANY = "Valnee Solutions";

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={UPDATED}>
      <p>
        Northstar (&quot;Northstar&quot;, &quot;we&quot;, &quot;us&quot;) is
        provided by {COMPANY}. This policy explains what information we
        collect when you use Northstar, how we use it, and the choices you
        have. By using Northstar, you agree to the practices described here.
      </p>

      <LegalSection title="1. Information we collect">
        <p>
          <strong>Account information.</strong> When you sign in with Google,
          we receive your name, email address, and profile photo from your
          Google account. We use this to create and identify your account and
          organization within Northstar.
        </p>
        <p>
          <strong>Content you create.</strong> Projects, leads, financial
          models, marketing plans, ad ideas, comments, and any other data you
          enter into Northstar is stored so it can be shown back to you and
          the members of your organization.
        </p>
        <p>
          <strong>Connected third-party accounts.</strong> If you choose to
          connect integrations such as LinkedIn, YouTube, Reddit, or Apify, we
          store the access tokens and account identifiers needed to fetch data
          on your behalf (for example, post performance or engagement
          numbers) and, where you request it, to publish content to those
          platforms. We only request the scopes needed for these features.
        </p>
        <p>
          <strong>Usage data.</strong> We may log basic technical information
          (such as timestamps and error logs) to keep the service reliable and
          secure.
        </p>
      </LegalSection>

      <LegalSection title="2. How we use your information">
        <p>
          We use the information above to operate Northstar: authenticating
          you, scoping your data to your organization, generating research
          and recommendations (including through Google&apos;s Gemini API,
          which may use live Google Search results to ground answers),
          fetching data from and publishing content to the third-party
          integrations you connect, and communicating with you about your
          account (for example, transactional email sent via Resend).
        </p>
        <p>
          We do not sell your personal information, and we do not use your
          organization&apos;s data to train third-party models beyond what is
          required to generate the responses you request.
        </p>
      </LegalSection>

      <LegalSection title="3. Data storage and security">
        <p>
          Your data is stored in a Supabase-hosted database and is scoped to
          your organization; other organizations cannot access it. We use
          industry-standard measures, including encrypted connections, to
          protect data in transit. No method of storage or transmission is
          completely secure, but we work to protect your information using
          commercially reasonable safeguards.
        </p>
      </LegalSection>

      <LegalSection title="4. Sharing your information">
        <p>We share information only in the following circumstances:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            With service providers who help us run Northstar (for example,
            Supabase for hosting and authentication, Google for AI-generated
            research, and Resend for transactional email), under agreements
            that limit their use of your data to providing the service.
          </li>
          <li>
            With the third-party platforms you explicitly connect (such as
            LinkedIn or YouTube), solely to perform the actions you request.
          </li>
          <li>To comply with applicable law, legal process, or valid governmental request.</li>
          <li>With your consent, or at your direction.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Your choices and rights">
        <p>
          You can disconnect any third-party integration at any time from
          within Northstar, which revokes our access to that account. You may
          request access to, correction of, or deletion of your personal
          information by contacting us at{" "}
          <a
            className="text-violet-600 hover:underline"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          . If you delete your account, we delete your organization&apos;s
          data within a reasonable period, except where retention is required
          by law.
        </p>
      </LegalSection>

      <LegalSection title="6. Children's privacy">
        <p>
          Northstar is intended for business use and is not directed at
          children under 16. We do not knowingly collect personal information
          from children.
        </p>
      </LegalSection>

      <LegalSection title="7. Changes to this policy">
        <p>
          We may update this policy from time to time. If we make material
          changes, we will update the &quot;Last updated&quot; date above and,
          where appropriate, notify you directly.
        </p>
      </LegalSection>

      <LegalSection title="8. Contact us">
        <p>
          Questions about this policy or your data can be sent to{" "}
          <a
            className="text-violet-600 hover:underline"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
