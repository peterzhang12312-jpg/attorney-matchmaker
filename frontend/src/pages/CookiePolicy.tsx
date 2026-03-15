import LandingNav from "../components/landing/LandingNav";
import LandingFooter from "../components/landing/LandingFooter";

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <LandingNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">

        <h1 className="text-3xl font-semibold text-[#191918] mb-2">Cookie Policy</h1>
        <p className="text-[rgba(25,25,24,0.45)] text-sm mb-10">Effective Date: March 15, 2026 &nbsp;&middot;&nbsp; Last Updated: March 15, 2026</p>

        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          This Cookie Policy explains how Attorney Matchmaker ("we," "us," or "our"), operated by Peter Zhang at <strong>attorney-matchmaker.onrender.com</strong>, uses browser-based storage technologies when you visit or use our Service. This policy is part of our broader Privacy Policy. By using the Service, you acknowledge the practices described below.
        </p>

        {/* 1 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">1. What We Use: sessionStorage (Not Cookies)</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          Attorney Matchmaker <strong>does not currently set HTTP cookies</strong> for tracking, analytics, or advertising purposes. Instead, our application relies exclusively on the browser's built-in <strong>sessionStorage</strong> API to temporarily persist form state during your active session. This is a local browser feature — no data stored in sessionStorage is transmitted to our servers or accessible to third parties.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          sessionStorage is scoped to the current browser tab and is automatically cleared when the tab is closed. It is never persisted to disk in a way that survives a full browser restart or is accessible across multiple tabs or windows.
        </p>

        <h3 className="text-base font-semibold text-[#191918] mb-2 mt-6">What We Store in sessionStorage</h3>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-3 text-sm">
          The following intake form fields are temporarily stored in sessionStorage to preserve your progress as you navigate the multi-step intake form:
        </p>
        <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(25,25,24,0.08)]">
                <th className="text-left px-4 py-3 font-semibold text-[#191918]">Key</th>
                <th className="text-left px-4 py-3 font-semibold text-[#191918]">Data Stored</th>
                <th className="text-left px-4 py-3 font-semibold text-[#191918]">Stored?</th>
              </tr>
            </thead>
            <tbody className="text-[rgba(25,25,24,0.7)]">
              <tr className="border-b border-[rgba(25,25,24,0.06)]">
                <td className="px-4 py-3 font-mono text-xs">intake_step</td>
                <td className="px-4 py-3">Current wizard step (1–4)</td>
                <td className="px-4 py-3 text-green-600 font-medium">Yes</td>
              </tr>
              <tr className="border-b border-[rgba(25,25,24,0.06)]">
                <td className="px-4 py-3 font-mono text-xs">intake_urgency</td>
                <td className="px-4 py-3">Selected urgency level</td>
                <td className="px-4 py-3 text-green-600 font-medium">Yes</td>
              </tr>
              <tr className="border-b border-[rgba(25,25,24,0.06)]">
                <td className="px-4 py-3 font-mono text-xs">intake_budget_goals</td>
                <td className="px-4 py-3">Budget stage preferences and hourly rate ceiling</td>
                <td className="px-4 py-3 text-green-600 font-medium">Yes</td>
              </tr>
              <tr className="border-b border-[rgba(25,25,24,0.06)]">
                <td className="px-4 py-3 font-mono text-xs">intake_refinement_answers</td>
                <td className="px-4 py-3">Your answers to AI-generated follow-up questions</td>
                <td className="px-4 py-3 text-green-600 font-medium">Yes</td>
              </tr>
              <tr className="border-b border-[rgba(25,25,24,0.06)]">
                <td className="px-4 py-3 font-mono text-xs">intake_client_email</td>
                <td className="px-4 py-3">Your email address (for match result notifications)</td>
                <td className="px-4 py-3 text-green-600 font-medium">Yes</td>
              </tr>
              <tr className="border-b border-[rgba(25,25,24,0.06)]">
                <td className="px-4 py-3 font-mono text-xs">intake_advanced_*</td>
                <td className="px-4 py-3">Advanced search selections (jurisdiction, defendant evasiveness, etc.)</td>
                <td className="px-4 py-3 text-green-600 font-medium">Yes</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-xs">Case facts / description</td>
                <td className="px-4 py-3">The free-text description of your legal situation</td>
                <td className="px-4 py-3 text-red-500 font-medium">NOT stored</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>Case facts are intentionally not persisted.</strong> Because case descriptions may contain sensitive personal, financial, or legally privileged information, we have deliberately excluded this field from sessionStorage. This data exists only in your browser's active memory while you are on the intake form and is not retained if you navigate away, refresh, or close the tab.
        </p>

        {/* 2 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">2. No Third-Party Tracking Cookies</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          We do not embed any third-party tracking pixels, analytics SDKs (such as Google Analytics, Mixpanel, or Segment), social media widgets, or advertising tags on our Service. No third party receives information about your visit via cookies or trackers placed by us.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          We do not participate in cross-site tracking, behavioral profiling, retargeting, or interest-based advertising of any kind.
        </p>

        {/* 3 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">3. No Advertising Cookies</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          Attorney Matchmaker does not display advertisements and does not use advertising cookies, tracking pixels, or conversion beacons. We do not sell, rent, or share your browsing data with advertising networks, data brokers, or marketing platforms.
        </p>

        {/* 4 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">4. Session Storage vs. Persistent Storage</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          It is important to understand the distinction between the storage types browsers make available:
        </p>
        <ul className="list-disc list-outside ml-5 space-y-3 text-[rgba(25,25,24,0.7)] text-sm mb-4">
          <li>
            <strong>sessionStorage (what we use):</strong> Data is stored only for the duration of the current browser tab or window session. It is automatically deleted when you close the tab. It is tab-isolated — data in one tab cannot be read by another tab. It is stored entirely on your device and is not sent to our servers unless you explicitly submit the intake form.
          </li>
          <li>
            <strong>localStorage (what we do not use):</strong> Data persists on your device even after the browser is closed and reopened. We do not use localStorage for intake form data.
          </li>
          <li>
            <strong>HTTP cookies (what we do not set ourselves):</strong> Small files that servers can instruct browsers to store and return on subsequent requests. We do not instruct your browser to set any first-party tracking cookies. Infrastructure cookies set by our hosting provider (see Section 6) may apply.
          </li>
        </ul>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          Attorney portal users (licensed attorneys with registered accounts) may receive a session token stored in memory upon login. This token is used to authenticate API requests during your session and is not stored in sessionStorage or localStorage.
        </p>

        {/* 5 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">5. How to Clear Browser Storage</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          You can clear sessionStorage data at any time using your browser's built-in developer tools or privacy settings. Instructions for common browsers:
        </p>
        <ul className="list-disc list-outside ml-5 space-y-2 text-[rgba(25,25,24,0.7)] text-sm mb-4">
          <li><strong>Chrome / Edge:</strong> Open DevTools (F12) → Application tab → Storage → sessionStorage → right-click the domain → Clear. Or go to Settings → Privacy and Security → Clear browsing data → Cookies and other site data.</li>
          <li><strong>Firefox:</strong> Open DevTools (F12) → Storage tab → Session Storage → right-click the domain → Delete All. Or go to Settings → Privacy &amp; Security → Cookies and Site Data → Clear Data.</li>
          <li><strong>Safari:</strong> Develop menu → Show Web Inspector → Storage → Session Storage. Or Safari Preferences → Privacy → Manage Website Data → Remove.</li>
          <li><strong>Mobile browsers:</strong> Navigate to your browser's Settings → Site Settings or Privacy → Clear browsing data.</li>
        </ul>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          Closing your browser tab also clears all sessionStorage associated with that tab. No action is required on your part to ensure this data is removed.
        </p>

        {/* 6 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">6. Third-Party Infrastructure Services</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          While we do not set tracking cookies, certain infrastructure and service providers involved in operating the Service may set their own cookies or use other storage technologies as part of delivering their services. These are operational in nature and are not used for advertising or behavioral tracking.
        </p>

        <h3 className="text-base font-semibold text-[#191918] mb-2 mt-6">Render.com (Hosting Infrastructure)</h3>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          The Service is hosted on <strong>Render.com</strong>. As our cloud infrastructure provider, Render may set operational cookies related to load balancing, DDoS protection, and session routing. These cookies are technical necessities for delivering web content and do not profile your behavior or identity. They are governed by <a href="https://render.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#FCAA2D] underline">Render's Privacy Policy</a>.
        </p>

        <h3 className="text-base font-semibold text-[#191918] mb-2 mt-6">Resend (Transactional Email)</h3>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          We use <strong>Resend</strong> to deliver transactional emails such as case confirmation notices and match result notifications. Resend does not set cookies in your browser through our Service. Emails sent by Resend may include a single tracking pixel for delivery confirmation (to confirm the email was received), but this occurs within your email client, not on our website, and is governed by <a href="https://resend.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#FCAA2D] underline">Resend's Privacy Policy</a>.
        </p>

        <h3 className="text-base font-semibold text-[#191918] mb-2 mt-6">CourtListener / Free Law Project</h3>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          Attorney matching results are enriched using data from the <strong>CourtListener API</strong>, operated by the Free Law Project. This API is called server-side only — no CourtListener scripts, pixels, or cookies are loaded in your browser as part of our Service.
        </p>

        {/* 7 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">7. Do Not Track Signals</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          Some browsers support a "Do Not Track" (DNT) signal that you can enable to request that websites not track your browsing behavior. Because we do not engage in cross-site behavioral tracking, our Service's data practices are consistent with DNT preferences regardless of whether you have enabled this signal.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          We do not currently alter our Service behavior based on DNT signals, because there is no universally accepted standard for how websites should respond to them. We will revisit this position if a binding standard is established.
        </p>

        {/* 8 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">8. Updates to This Policy</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          We may update this Cookie Policy from time to time as our Service evolves or as legal requirements change. If we introduce new uses of cookies or storage technologies that are material to your privacy, we will update the "Last Updated" date at the top of this page and, where appropriate, provide notice through the Service or by email.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          We encourage you to review this policy periodically. Continued use of the Service following an update constitutes your acknowledgment of the revised policy.
        </p>

        {/* 9 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">9. Contact Us</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          If you have questions about this Cookie Policy or our data practices, please contact us:
        </p>
        <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5 text-sm text-[rgba(25,25,24,0.7)]">
          <p className="font-semibold text-[#191918] mb-1">Attorney Matchmaker</p>
          <p>Operated by: Peter Zhang</p>
          <p>Email: <a href="mailto:eclbk_legal@ahs.us.com" className="text-[#FCAA2D] underline">eclbk_legal@ahs.us.com</a></p>
          <p>Website: <a href="https://attorney-matchmaker.onrender.com" className="text-[#FCAA2D] underline">attorney-matchmaker.onrender.com</a></p>
        </div>

      </main>
      <LandingFooter />
    </div>
  );
}
