import LandingNav from "../components/landing/LandingNav";
import LandingFooter from "../components/landing/LandingFooter";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <LandingNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">

        {/* Header */}
        <div className="mb-10">
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-3">
            Legal
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#191918] mb-4">
            Privacy Policy
          </h1>
          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed text-sm">
            Effective Date: March 15, 2026 &nbsp;&middot;&nbsp; Last Updated: March 15, 2026
          </p>
          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed text-sm mt-2">
            This Privacy Policy describes how Attorney Matchmaker ("we," "us," or "our"), operated by Peter
            Zhang, collects, uses, stores, and shares information when you use our platform at{" "}
            <a
              href="https://attorney-matchmaker.onrender.com"
              className="text-[#FCAA2D] underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              attorney-matchmaker.onrender.com
            </a>{" "}
            (the "Service"). By using the Service, you agree to the practices described in this Policy.
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-[rgba(25,25,24,0.12)] mb-2" />

        {/* 1. Information We Collect */}
        <section>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-8 mb-1">
            Section 1
          </p>
          <h2 className="text-xl font-semibold text-[#191918] mb-3">
            Information We Collect
          </h2>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            We collect information you provide directly, information generated as you use the Service, and
            limited technical information necessary to operate the platform.
          </p>

          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5 mb-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#191918] mb-1">Case Information (Client Users)</h3>
              <p className="text-[rgba(25,25,24,0.7)] leading-relaxed text-sm">
                When you submit a legal matter through our intake form, we collect: a description of your case
                facts, your urgency level, budget and financial goals (hourly rate ceiling, matter type
                preferences), and optionally your email address. You may also provide advanced search
                parameters such as preferred jurisdiction, venue, litigation stage, opposing party type, and
                whether the defendant may be evading service. Case facts are processed by AI and are not
                persisted to session storage — all other form state is stored locally in your browser's
                sessionStorage only.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#191918] mb-1">Attorney Registration Data</h3>
              <p className="text-[rgba(25,25,24,0.7)] leading-relaxed text-sm">
                Attorneys who create an account provide: full name, email address, bar number, law firm name,
                jurisdictions, practice areas, hourly rate, availability, and whether they are currently
                accepting new clients. A bcrypt-hashed password is stored — we never store your plaintext
                password. Accounts created among the first 20 registrants receive a "Founding Attorney" badge
                designation in their profile.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#191918] mb-1">Usage and Technical Data</h3>
              <p className="text-[rgba(25,25,24,0.7)] leading-relaxed text-sm">
                Our servers automatically receive standard HTTP request metadata including IP address, browser
                user-agent, referring URL, and timestamps. We use structured server-side logging
                (structlog) for reliability and debugging. Each request is assigned a unique X-Request-ID
                header for tracing. We do not use analytics SDKs, advertising pixels, or third-party
                tracking scripts.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#191918] mb-1">Publicly Available Court Data</h3>
              <p className="text-[rgba(25,25,24,0.7)] leading-relaxed text-sm">
                To build attorney profiles and verify experience, we query CourtListener's public API for
                federal docket entries, attorney names, firm affiliations, and case history. This data is
                sourced from public court records and is not user-submitted.
              </p>
            </div>
          </div>
        </section>

        {/* 2. How We Use Your Information */}
        <section>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-8 mb-1">
            Section 2
          </p>
          <h2 className="text-xl font-semibold text-[#191918] mb-3">
            How We Use Your Information
          </h2>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            We use the information we collect for the following purposes:
          </p>

          <ul className="space-y-3 mb-4">
            {[
              {
                title: "AI-Powered Attorney Matching",
                body: "Your case facts and budget preferences are sent to Google Gemini (for factual analysis and question generation) and Anthropic Claude (for match auditing and leaderboard auditing) to identify and rank attorneys best suited to your legal matter. These AI providers process your data under their own privacy policies and data processing agreements. We do not sell your case facts to these providers — they are used solely to perform inference on your behalf.",
              },
              {
                title: "Transactional Email Notifications",
                body: "If you provide your email address, we use it to send transactional messages including: confirmation that your case was received, notification when attorney matches are ready, and (for attorneys) notification when a new lead matches their practice area. Email delivery is handled by Resend (resend.com). We do not send marketing emails without your explicit consent.",
              },
              {
                title: "Attorney Lead Delivery",
                body: "When a client case matches an attorney's profile, a case summary (excluding personally identifying client details where possible) is delivered to the attorney as a lead through their dashboard and optionally via email. Attorneys may accept or decline leads.",
              },
              {
                title: "Service Operation and Improvement",
                body: "We use aggregated, de-identified usage data to understand how the platform is used, diagnose errors, improve matching algorithms, and plan new features. We do not build individual behavioral profiles for advertising purposes.",
              },
              {
                title: "Legal Compliance and Security",
                body: "We may use and retain information as required by applicable law, to respond to legal process, enforce our Terms of Service, prevent fraud, or protect the rights and safety of our users and the public.",
              },
            ].map((item) => (
              <li
                key={item.title}
                className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-4"
              >
                <h3 className="text-sm font-semibold text-[#191918] mb-1">{item.title}</h3>
                <p className="text-[rgba(25,25,24,0.7)] leading-relaxed text-sm">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. Data Storage and Security */}
        <section>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-8 mb-1">
            Section 3
          </p>
          <h2 className="text-xl font-semibold text-[#191918] mb-3">
            Data Storage and Security
          </h2>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            All data submitted to the Service is stored in a PostgreSQL database hosted on Render.com
            (render.com), a cloud infrastructure provider based in the United States. Render encrypts data at
            rest and in transit (TLS 1.2+). Our database is not publicly accessible — it communicates only
            with our backend application over Render's internal private network.
          </p>
          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            Passwords are hashed using bcrypt before storage. JWT authentication tokens are signed with a
            secret key and expire after a defined session period. API endpoints are rate-limited (via
            slowapi) to prevent abuse: intake submissions are limited to 10 per minute per IP, and match
            requests to 5 per minute per IP.
          </p>
          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            While we implement reasonable technical safeguards, no system is perfectly secure. You should
            avoid submitting information that is more sensitive than necessary to describe your legal matter.
            Do not submit social security numbers, financial account numbers, or medical records through the
            intake form.
          </p>
        </section>

        {/* 4. Third-Party Services */}
        <section>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-8 mb-1">
            Section 4
          </p>
          <h2 className="text-xl font-semibold text-[#191918] mb-3">
            Third-Party Services
          </h2>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            We use the following third-party providers to operate the Service. Each provider processes data
            under their own privacy policies, which we encourage you to review.
          </p>

          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[rgba(25,25,24,0.12)]">
                  <th className="text-left py-2 pr-4 font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">
                    Provider
                  </th>
                  <th className="text-left py-2 pr-4 font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">
                    Purpose
                  </th>
                  <th className="text-left py-2 font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">
                    Data Shared
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(25,25,24,0.07)]">
                {[
                  {
                    provider: "Google Gemini",
                    purpose: "Case fact analysis, question generation, keyword extraction",
                    data: "Case description, facts",
                  },
                  {
                    provider: "Anthropic Claude",
                    purpose: "Match audit, leaderboard audit",
                    data: "Case summary, attorney match candidates",
                  },
                  {
                    provider: "CourtListener (Free Law Project)",
                    purpose: "Public court docket lookup, attorney profile enrichment",
                    data: "Attorney names, search keywords",
                  },
                  {
                    provider: "Resend",
                    purpose: "Transactional email delivery",
                    data: "Recipient email, email body content",
                  },
                  {
                    provider: "Render.com",
                    purpose: "Cloud hosting, database, TLS termination",
                    data: "All application data (hosted infrastructure)",
                  },
                ].map((row) => (
                  <tr key={row.provider}>
                    <td className="py-2.5 pr-4 font-semibold text-[#191918]">{row.provider}</td>
                    <td className="py-2.5 pr-4 text-[rgba(25,25,24,0.7)]">{row.purpose}</td>
                    <td className="py-2.5 text-[rgba(25,25,24,0.7)]">{row.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            We do not sell your personal information to any third party. We do not share your data with
            advertisers, data brokers, or analytics platforms.
          </p>
        </section>

        {/* 5. Cookies and Session Storage */}
        <section>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-8 mb-1">
            Section 5
          </p>
          <h2 className="text-xl font-semibold text-[#191918] mb-3">
            Cookies and Browser Storage
          </h2>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            We do not use tracking cookies, advertising cookies, or analytics cookies. We do not load any
            third-party cookie-based tracking scripts.
          </p>
          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            The intake form uses your browser's <code className="font-mono text-[0.85em] bg-[rgba(25,25,24,0.06)] px-1 py-0.5 rounded">sessionStorage</code> to
            temporarily preserve your progress across form steps (urgency, budget goals, refinement answers,
            advanced search parameters, and client email). This data is stored entirely within your browser,
            is never transmitted to our servers until you submit the form, and is cleared when you close the
            browser tab. We deliberately do not persist case facts to sessionStorage given their sensitive
            nature.
          </p>
          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            Attorney authentication uses a JWT token stored in your browser's{" "}
            <code className="font-mono text-[0.85em] bg-[rgba(25,25,24,0.06)] px-1 py-0.5 rounded">localStorage</code>{" "}
            to maintain your logged-in session. This token is scoped to this domain and is not accessible to
            third-party scripts.
          </p>
        </section>

        {/* 6. Data Retention */}
        <section>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-8 mb-1">
            Section 6
          </p>
          <h2 className="text-xl font-semibold text-[#191918] mb-3">
            Data Retention
          </h2>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            We retain different categories of data for different periods based on their purpose and applicable
            legal requirements:
          </p>

          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] divide-y divide-[rgba(25,25,24,0.07)] mb-4">
            {[
              {
                category: "Case submissions and match results",
                retention: "90 days from submission, then permanently deleted",
              },
              {
                category: "Client email addresses",
                retention: "90 days, or until deletion request, whichever comes first",
              },
              {
                category: "Attorney account data",
                retention: "Until the attorney submits a deletion request or closes their account",
              },
              {
                category: "Lead records",
                retention: "90 days from the date the lead was created",
              },
              {
                category: "Server logs",
                retention: "30 days on a rolling basis for security and debugging purposes",
              },
            ].map((row) => (
              <div key={row.category} className="px-5 py-3.5 flex gap-4">
                <span className="text-sm font-semibold text-[#191918] min-w-[200px] shrink-0">
                  {row.category}
                </span>
                <span className="text-sm text-[rgba(25,25,24,0.7)]">{row.retention}</span>
              </div>
            ))}
          </div>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            We may retain data longer if required by law or to resolve an active legal dispute.
          </p>
        </section>

        {/* 7. Your Rights */}
        <section>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-8 mb-1">
            Section 7
          </p>
          <h2 className="text-xl font-semibold text-[#191918] mb-3">
            Your Rights and Choices
          </h2>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            Depending on your jurisdiction, you may have the following rights with respect to your personal
            information. To exercise any of these rights, contact us at{" "}
            <a href="mailto:eclbk_legal@ahs.us.com" className="text-[#FCAA2D] underline underline-offset-2 hover:opacity-80 transition-opacity">
              eclbk_legal@ahs.us.com
            </a>
            . We will respond to verifiable requests within 30 days.
          </p>

          <div className="space-y-3 mb-4">
            {[
              {
                right: "Right to Access",
                desc: "You may request a copy of the personal information we hold about you, including case submissions associated with your email address and attorney account data.",
              },
              {
                right: "Right to Correction",
                desc: "You may request that we correct inaccurate personal information. Attorney profile information can be updated directly through the attorney dashboard without contacting us.",
              },
              {
                right: "Right to Deletion",
                desc: "You may request that we delete your personal information. For case data, we will delete all records associated with your submitted email. For attorney accounts, we will permanently delete your account, profile, and associated lead history. Note that deletion of attorney data may affect ongoing leads.",
              },
              {
                right: "Right to Data Portability",
                desc: "You may request an export of your personal data in a machine-readable format (JSON).",
              },
              {
                right: "Right to Opt Out of AI Processing",
                desc: "If you do not want your case facts processed by third-party AI models (Gemini, Claude), you should not use the matching feature. You may use the attorney directory and leaderboard features without submitting a case.",
              },
            ].map((item) => (
              <div
                key={item.right}
                className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-4"
              >
                <h3 className="text-sm font-semibold text-[#191918] mb-1">{item.right}</h3>
                <p className="text-[rgba(25,25,24,0.7)] leading-relaxed text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 8. CCPA */}
        <section>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-8 mb-1">
            Section 8
          </p>
          <h2 className="text-xl font-semibold text-[#191918] mb-3">
            California Privacy Rights (CCPA / CPRA)
          </h2>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            If you are a California resident, the California Consumer Privacy Act (CCPA) as amended by the
            California Privacy Rights Act (CPRA) provides you with specific rights regarding your personal
            information.
          </p>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            <strong className="font-semibold text-[#191918]">Categories of personal information collected:</strong>{" "}
            Identifiers (email address, IP address), professional information (bar number, firm, practice
            areas, jurisdictions), and commercial information (budget preferences, hourly rate). We also
            process the contents of your communications (case facts and legal matter descriptions) when you
            submit them through our intake form.
          </p>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            <strong className="font-semibold text-[#191918]">We do not sell your personal information</strong>{" "}
            as defined under CCPA. We do not share personal information with third parties for cross-context
            behavioral advertising.
          </p>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            California residents have the right to: (1) know what personal information is collected, used,
            and shared; (2) delete personal information we hold; (3) correct inaccurate personal information;
            (4) opt out of the sale or sharing of personal information; and (5) non-discrimination for
            exercising these rights. To exercise your California rights, email{" "}
            <a href="mailto:eclbk_legal@ahs.us.com" className="text-[#FCAA2D] underline underline-offset-2 hover:opacity-80 transition-opacity">
              eclbk_legal@ahs.us.com
            </a>{" "}
            with the subject line "California Privacy Request."
          </p>
        </section>

        {/* 9. GDPR */}
        <section>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-8 mb-1">
            Section 9
          </p>
          <h2 className="text-xl font-semibold text-[#191918] mb-3">
            European Users (GDPR)
          </h2>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            If you are located in the European Economic Area (EEA), the United Kingdom, or Switzerland, the
            General Data Protection Regulation (GDPR) and applicable national laws may apply to the
            processing of your personal data.
          </p>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            <strong className="font-semibold text-[#191918]">Legal bases for processing:</strong> We process
            your data under the following legal bases: (a) <em>Performance of a contract</em> — processing
            your case submission to provide the attorney matching service you requested; (b){" "}
            <em>Legitimate interests</em> — operating and improving the Service, preventing fraud, ensuring
            security; (c) <em>Consent</em> — where you have explicitly provided your email address for
            notification purposes.
          </p>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            <strong className="font-semibold text-[#191918]">International transfers:</strong> Our
            infrastructure (Render.com) is located in the United States. If you submit data from the EEA,
            your data will be transferred to and processed in the United States. We rely on Standard
            Contractual Clauses and Render's data processing agreements for such transfers.
          </p>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            EEA/UK residents have all rights described in Section 7, plus the right to lodge a complaint with
            your local data protection supervisory authority. To exercise your GDPR rights, contact us at{" "}
            <a href="mailto:eclbk_legal@ahs.us.com" className="text-[#FCAA2D] underline underline-offset-2 hover:opacity-80 transition-opacity">
              eclbk_legal@ahs.us.com
            </a>
            .
          </p>
        </section>

        {/* 10. Attorney-Client Privilege Notice */}
        <section>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-8 mb-1">
            Section 10
          </p>
          <h2 className="text-xl font-semibold text-[#191918] mb-3">
            Important Notice Regarding Attorney-Client Privilege
          </h2>

          <div className="bg-amber-50 border border-amber-200 rounded-[10px] p-5 mb-4">
            <p className="text-[rgba(25,25,24,0.8)] leading-relaxed text-sm">
              <strong className="font-semibold text-[#191918]">Attorney Matchmaker is not a law firm and does not provide legal advice.</strong>{" "}
              No attorney-client relationship is formed by using this Service. The case information you
              submit is used solely to identify and suggest potentially suitable attorneys — it is not
              privileged communication. Do not submit confidential information you would not be comfortable
              sharing with a matching platform. If you have sensitive privileged matter details, share them
              only directly with the attorney you ultimately retain.
            </p>
          </div>
        </section>

        {/* 11. Children */}
        <section>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-8 mb-1">
            Section 11
          </p>
          <h2 className="text-xl font-semibold text-[#191918] mb-3">
            Children's Privacy
          </h2>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            The Service is intended for adults 18 years of age and older. We do not knowingly collect
            personal information from children under the age of 13 (or under the applicable age of digital
            consent in your jurisdiction). If you believe a child has submitted information to us, please
            contact us immediately at{" "}
            <a href="mailto:eclbk_legal@ahs.us.com" className="text-[#FCAA2D] underline underline-offset-2 hover:opacity-80 transition-opacity">
              eclbk_legal@ahs.us.com
            </a>{" "}
            and we will delete it promptly.
          </p>
        </section>

        {/* 12. Changes */}
        <section>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-8 mb-1">
            Section 12
          </p>
          <h2 className="text-xl font-semibold text-[#191918] mb-3">
            Changes to This Policy
          </h2>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            We may update this Privacy Policy from time to time. When we make material changes, we will
            update the "Last Updated" date at the top of this page. If you have provided an email address,
            we may notify you of material changes by email. Your continued use of the Service after any
            change constitutes acceptance of the updated Policy. We encourage you to review this page
            periodically.
          </p>
        </section>

        {/* 13. Contact */}
        <section>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-8 mb-1">
            Section 13
          </p>
          <h2 className="text-xl font-semibold text-[#191918] mb-3">
            Contact Us
          </h2>

          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
            If you have questions, concerns, or requests regarding this Privacy Policy or our data practices,
            please contact us:
          </p>

          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5">
            <p className="text-sm font-semibold text-[#191918] mb-1">Attorney Matchmaker</p>
            <p className="text-[rgba(25,25,24,0.7)] text-sm mb-0.5">Operated by: Peter Zhang</p>
            <p className="text-[rgba(25,25,24,0.7)] text-sm mb-0.5">
              Email:{" "}
              <a
                href="mailto:eclbk_legal@ahs.us.com"
                className="text-[#FCAA2D] underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                eclbk_legal@ahs.us.com
              </a>
            </p>
            <p className="text-[rgba(25,25,24,0.7)] text-sm">
              Website:{" "}
              <a
                href="https://attorney-matchmaker.onrender.com"
                className="text-[#FCAA2D] underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                attorney-matchmaker.onrender.com
              </a>
            </p>
          </div>

          <p className="text-[rgba(25,25,24,0.45)] text-xs mt-6 leading-relaxed">
            This privacy policy was prepared for Attorney Matchmaker and reflects our actual data practices
            as of the effective date above. This document does not constitute legal advice and we recommend
            consulting a licensed attorney for compliance review specific to your jurisdiction and business
            model.
          </p>
        </section>

      </main>
      <LandingFooter />
    </div>
  );
}
