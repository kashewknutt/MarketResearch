import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — Northstar",
  description: "The terms that govern your use of Northstar.",
};

const UPDATED = "July 23, 2026";
const CONTACT_EMAIL = "rajat@valnee.com";
const COMPANY = "Valnee Solutions";

export default function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service" updated={UPDATED}>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and
        use of Northstar, a product of {COMPANY} (&quot;we&quot;,
        &quot;us&quot;). By creating an account or otherwise using Northstar,
        you agree to these Terms. If you are using Northstar on behalf of an
        organization, you are agreeing on its behalf and confirming you have
        the authority to do so.
      </p>

      <LegalSection title="1. The service">
        <p>
          Northstar helps teams research demand, track projects and leads,
          model financials, and plan and monitor marketing and advertising
          activity, using data researched in real time and content you
          provide. Features may change, and we may add, modify, or remove
          functionality over time.
        </p>
      </LegalSection>

      <LegalSection title="2. Accounts and access">
        <p>
          You must sign in with a valid Google account to use Northstar.
          You are responsible for maintaining the confidentiality of your
          account and for all activity that occurs under it. Access within an
          organization is managed by that organization&apos;s owner, who may
          add or remove members and their access to organizational data.
        </p>
      </LegalSection>

      <LegalSection title="3. Acceptable use">
        <p>You agree not to use Northstar to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Violate any applicable law or the rights of any third party;</li>
          <li>
            Upload or generate content that is unlawful, fraudulent, or
            infringes intellectual property or privacy rights;
          </li>
          <li>
            Attempt to gain unauthorized access to Northstar, other
            organizations&apos; data, or connected third-party accounts;
          </li>
          <li>
            Interfere with or disrupt the integrity or performance of the
            service; or
          </li>
          <li>
            Use the service to publish content to connected platforms (such
            as LinkedIn or YouTube) in a manner that violates those
            platforms&apos; own terms.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Third-party integrations and AI-generated content">
        <p>
          Northstar integrates with third-party services, including Google
          (Gemini and Search), Reddit, LinkedIn, YouTube, and Apify. Your use
          of these integrations is also subject to the respective third
          party&apos;s terms. Research, projections, and recommendations
          generated within Northstar are produced with the assistance of AI
          models and external data sources; they may be incomplete or
          inaccurate and are provided for informational purposes only. You
          are responsible for independently verifying any research, financial
          projection, or recommendation before relying on it for a business
          decision.
        </p>
      </LegalSection>

      <LegalSection title="5. Your content">
        <p>
          You retain ownership of the content and data you enter into
          Northstar. You grant us a limited license to store, process, and
          display that content solely to provide the service to you and your
          organization. You are responsible for ensuring you have the right
          to upload any content you provide.
        </p>
      </LegalSection>

      <LegalSection title="6. Intellectual property">
        <p>
          Northstar, including its design, features, and underlying
          technology, is owned by {COMPANY} and protected by intellectual
          property laws. These Terms do not grant you any rights to our
          trademarks or branding.
        </p>
      </LegalSection>

      <LegalSection title="7. Disclaimers">
        <p>
          Northstar is provided &quot;as is&quot; and &quot;as available&quot;
          without warranties of any kind, whether express or implied,
          including warranties of merchantability, fitness for a particular
          purpose, or non-infringement. We do not warrant that the service
          will be uninterrupted, error-free, or that research, financial
          modeling, or performance data will be accurate or complete.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitation of liability">
        <p>
          To the fullest extent permitted by law, {COMPANY} will not be liable
          for any indirect, incidental, special, consequential, or punitive
          damages, or any loss of profits, revenue, data, or business
          opportunity, arising out of or relating to your use of Northstar,
          even if advised of the possibility of such damages.
        </p>
      </LegalSection>

      <LegalSection title="9. Termination">
        <p>
          You may stop using Northstar and request deletion of your account
          at any time. We may suspend or terminate access to Northstar if we
          reasonably believe you have violated these Terms or if continued
          access poses a risk to the service or other users.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to these Terms">
        <p>
          We may update these Terms from time to time. If we make material
          changes, we will update the &quot;Last updated&quot; date above and,
          where appropriate, notify you directly. Continued use of Northstar
          after changes take effect constitutes acceptance of the updated
          Terms.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact us">
        <p>
          Questions about these Terms can be sent to{" "}
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
