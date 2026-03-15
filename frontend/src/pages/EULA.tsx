import LandingNav from "../components/landing/LandingNav";
import LandingFooter from "../components/landing/LandingFooter";

export default function EULA() {
  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <LandingNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">

        <h1 className="text-3xl font-semibold text-[#191918] mb-2">End User License Agreement</h1>
        <p className="text-[rgba(25,25,24,0.45)] text-sm mb-10">Effective Date: March 15, 2026 &nbsp;&middot;&nbsp; Last Updated: March 15, 2026</p>

        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          Please read this End User License Agreement ("Agreement" or "EULA") carefully before using Attorney Matchmaker (the "Service"), operated by Peter Zhang ("we," "us," or "our") at <strong>attorney-matchmaker.onrender.com</strong>. By accessing or using the Service in any way, you ("User," "you," or "your") agree to be bound by this Agreement. If you do not agree to all of these terms, do not use the Service.
        </p>

        {/* 1 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">1. Acceptance of Terms</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          By creating an account, submitting a case intake form, accessing the attorney matching results, or otherwise using any feature of the Service, you affirm that you have read, understood, and agree to be legally bound by this Agreement and our Privacy Policy, which is incorporated herein by reference. Your continued use of the Service following any modification to this Agreement constitutes your acceptance of the revised terms.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          If you are using the Service on behalf of an organization or entity, you represent and warrant that you have the authority to bind that organization to this Agreement, and references to "you" include both you individually and that organization.
        </p>

        {/* 2 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">2. Description of Service</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          Attorney Matchmaker is an AI-powered legal technology platform that helps individuals identify and connect with licensed attorneys who may be relevant to their legal situation. The Service accepts user-submitted case descriptions and other inputs, processes them using artificial intelligence tools (including but not limited to Google Gemini and Anthropic Claude), cross-references publicly available court records via CourtListener and related legal databases, and generates ranked lists of potentially relevant attorneys along with venue recommendations and case analysis summaries.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          The Service also provides an attorney registration portal through which licensed attorneys may create accounts, complete a professional profile, and receive leads from users whose cases may align with their practice areas.
        </p>

        {/* CRITICAL DISCLAIMER */}
        <div className="bg-amber-50 border border-amber-200 rounded-[10px] p-5 my-6">
          <p className="text-[#191918] font-semibold text-sm mb-2">IMPORTANT LEGAL NOTICE — PLEASE READ</p>
          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed text-sm mb-2">
            <strong>Attorney Matchmaker is NOT a law firm and does NOT provide legal advice.</strong> We are a technology intermediary. Nothing on this platform — including AI-generated case analysis, venue recommendations, attorney match results, docket intelligence summaries, or any other output — constitutes legal advice, legal representation, or the formation of an attorney-client relationship.
          </p>
          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed text-sm mb-2">
            Attorney matching results are <strong>informational suggestions only</strong>. They are generated algorithmically based on publicly available data and user-provided inputs. A match or high ranking does not constitute an endorsement, recommendation, or guarantee of any attorney's fitness, competence, availability, or suitability for your matter.
          </p>
          <p className="text-[rgba(25,25,24,0.7)] leading-relaxed text-sm">
            You should independently verify any attorney's credentials, bar admission status, disciplinary history, and availability before engaging them. Always consult a licensed attorney directly for legal advice specific to your situation. Do not rely on any output from this Service as a substitute for qualified legal counsel.
          </p>
        </div>

        {/* 3 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">3. User Eligibility</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          The Service is intended solely for individuals who are 18 years of age or older and who are residents of the United States. By using the Service, you represent and warrant that:
        </p>
        <ul className="list-disc list-outside ml-5 space-y-2 text-[rgba(25,25,24,0.7)] text-sm mb-4">
          <li>You are at least 18 years old;</li>
          <li>You are a resident of the United States or are submitting a matter arising under U.S. law;</li>
          <li>You have the legal capacity to enter into a binding agreement;</li>
          <li>You will use the Service only in compliance with this Agreement and all applicable federal, state, and local laws; and</li>
          <li>You have not been previously suspended or removed from the Service.</li>
        </ul>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          Attorneys registering for professional accounts additionally represent that they are licensed to practice law in at least one U.S. jurisdiction and are in good standing with the relevant bar association(s) at the time of registration and at all times while maintaining an active account.
        </p>

        {/* 4 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">4. Attorney Accounts and the Founding Attorney Program</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          Licensed attorneys may register for a professional account on the Service. By registering, attorneys agree to the following additional terms:
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>4.1 Profile Accuracy.</strong> Attorneys are solely responsible for the accuracy, completeness, and currency of all information in their profiles, including but not limited to bar number, jurisdictions, practice areas, hourly rate, and availability. We reserve the right to remove or suspend any profile that contains inaccurate, misleading, or unverifiable information.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>4.2 Founding Attorney Program.</strong> The first twenty (20) attorneys who complete registration on the Service are designated "Founding Attorneys" and may receive promotional recognition on the platform. Founding Attorney status is a marketing designation only and does not confer any legal rights, guaranteed leads, preferential ranking, or other contractual obligations on either party.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>4.3 Lead Fees.</strong> Attorneys who accept a client lead through the Service agree to pay a lead fee ranging from <strong>$25 to $75 per accepted lead</strong>, as determined by the lead category, practice area, and case complexity at the time of lead delivery. The applicable fee will be disclosed to the attorney prior to acceptance. Lead fees are non-refundable once an attorney has accepted a lead, regardless of whether an engagement with the prospective client is ultimately formed.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>4.4 No Guarantee of Leads.</strong> We make no representation or warranty that any attorney will receive any minimum number of leads, that leads will result in client engagements, or that the Service will generate any particular level of business for any attorney. The Service is provided on an "as available" basis.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>4.5 Professional Responsibility.</strong> Attorneys are solely responsible for complying with all applicable rules of professional conduct, including rules governing attorney advertising, solicitation, fee-sharing, and client communication, as promulgated by the relevant state bar authorities. Nothing in this Agreement modifies or supersedes an attorney's professional obligations.
        </p>

        {/* 5 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">5. Prohibited Uses</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          You agree that you will not use the Service to:
        </p>
        <ul className="list-disc list-outside ml-5 space-y-2 text-[rgba(25,25,24,0.7)] text-sm mb-4">
          <li>Submit false, fraudulent, fabricated, or misleading case descriptions or personal information;</li>
          <li>Impersonate any person, attorney, law firm, or entity;</li>
          <li>Harass, threaten, defame, or intimidate any attorney, user, or third party;</li>
          <li>Engage in any activity that violates any applicable federal, state, or local law or regulation;</li>
          <li>Attempt to reverse-engineer, scrape, copy, or distribute any AI-generated outputs, attorney profiles, or proprietary algorithms;</li>
          <li>Use automated bots, scrapers, or scripts to interact with the Service without prior written authorization;</li>
          <li>Circumvent, disable, or otherwise interfere with security-related features of the Service;</li>
          <li>Upload or transmit viruses, malware, or any other malicious code;</li>
          <li>Use the Service to facilitate any form of unauthorized data collection about attorneys or users;</li>
          <li>Submit case descriptions that relate to matters that are clearly fictitious, hypothetical, or intended to test or game the AI systems;</li>
          <li>Use the Service for any purpose that competes with our business without prior written consent; or</li>
          <li>Encourage or assist any third party to do any of the foregoing.</li>
        </ul>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          Violation of these prohibitions may result in immediate termination of your access and, where appropriate, referral to law enforcement.
        </p>

        {/* 6 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">6. AI-Generated Content Disclaimer</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          The Service uses large language models and other AI technologies to analyze case descriptions, generate refinement questions, identify potentially relevant attorneys, recommend venues, summarize docket intelligence, and produce match audit commentary. You acknowledge and agree that:
        </p>
        <ul className="list-disc list-outside ml-5 space-y-2 text-[rgba(25,25,24,0.7)] text-sm mb-4">
          <li>AI-generated outputs are probabilistic in nature and may contain errors, omissions, hallucinations, or outdated information;</li>
          <li>Attorney match rankings are algorithmic suggestions and do not reflect a professional evaluation of any attorney's qualifications;</li>
          <li>Venue recommendations are generated based on general legal principles and publicly available information, not legal advice tailored to your specific facts;</li>
          <li>Docket intelligence and case history data are derived from publicly available court records and may be incomplete, inaccurate, or misattributed;</li>
          <li>AI-generated refinement questions and case analysis summaries are informational only and do not create any professional relationship; and</li>
          <li>You should not take any legal action, make any legal decision, or forgo consulting a licensed attorney based solely on AI-generated output from this Service.</li>
        </ul>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          We do not warrant the accuracy, completeness, or fitness for purpose of any AI-generated content on the Service.
        </p>

        {/* 7 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">7. Payment Terms</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>7.1 Lead Fees.</strong> Lead fees are charged to attorneys who accept leads through the Service. The applicable fee is disclosed prior to acceptance. Payment is due upon acceptance of a lead. We reserve the right to modify lead fee rates at any time, with notice provided to affected attorneys at least fourteen (14) days in advance of any change.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>7.2 No Refunds on Accepted Leads.</strong> All lead fees are non-refundable once a lead has been accepted, regardless of whether the prospective client responds, retains the attorney, or whether the matter proceeds to engagement. If you believe a lead was fraudulent or materially misrepresented, you may submit a dispute within seven (7) days of acceptance for review at our sole discretion.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>7.3 Taxes.</strong> You are responsible for all applicable taxes arising from your use of the Service. We will provide documentation necessary for your tax records upon request.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>7.4 Free Use for Prospective Clients.</strong> The Service is provided free of charge to prospective clients submitting case intake information. We do not charge prospective clients a fee for receiving attorney match results.
        </p>

        {/* 8 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">8. Intellectual Property</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>8.1 Our Property.</strong> The Service and all content, features, and functionality thereof — including but not limited to the source code, AI models and prompts, matching algorithms, venue optimization logic, user interface design, graphics, text, and trademarks — are owned by Peter Zhang and are protected by United States and international intellectual property laws. You are granted a limited, non-exclusive, non-transferable, revocable license to use the Service for its intended purpose in accordance with this Agreement.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>8.2 Your Content.</strong> By submitting case descriptions, responses, attorney profiles, or other content to the Service ("User Content"), you grant us a non-exclusive, worldwide, royalty-free license to use, store, process, and display such User Content solely for the purpose of operating and improving the Service. You represent and warrant that you own or have the rights to submit all User Content and that it does not violate any third party's rights.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>8.3 Feedback.</strong> Any feedback, suggestions, or ideas you provide regarding the Service may be used by us without restriction or compensation.
        </p>

        {/* 9 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">9. Limitation of Liability</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL PETER ZHANG, THE SERVICE, OR ANY OF ITS OFFICERS, EMPLOYEES, CONTRACTORS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, LOSS OF DATA, LOSS OF GOODWILL, SERVICE INTERRUPTION, COMPUTER DAMAGE, SYSTEM FAILURE, OR THE COST OF SUBSTITUTE SERVICES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, OUR TOTAL CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATED TO THIS AGREEMENT OR YOUR USE OF THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE TOTAL FEES PAID BY YOU TO US IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE CLAIM, OR (B) ONE HUNDRED DOLLARS ($100.00).
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF LIABILITY FOR CERTAIN DAMAGES, SO THE ABOVE LIMITATIONS MAY NOT APPLY TO YOU IN FULL.
        </p>

        {/* 10 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">10. Disclaimer of Warranties</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS, OR THAT DEFECTS WILL BE CORRECTED. WE DO NOT WARRANT THE ACCURACY OR COMPLETENESS OF ANY ATTORNEY INFORMATION, AI-GENERATED CONTENT, COURT RECORD DATA, OR VENUE RECOMMENDATION PROVIDED THROUGH THE SERVICE.
        </p>

        {/* 11 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">11. Indemnification</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          You agree to indemnify, defend, and hold harmless Peter Zhang and any successors, assigns, officers, employees, and contractors from and against any and all claims, liabilities, damages, judgments, penalties, losses, costs, expenses, and fees (including reasonable attorneys' fees) arising out of or relating to: (a) your use of or access to the Service; (b) your violation of this Agreement; (c) your violation of any applicable law or regulation; (d) your User Content; (e) any misrepresentation made by you in connection with the Service; or (f) your violation of the rights of any third party, including any attorney whose profile appears on the Service.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          We reserve the right to assume the exclusive defense and control of any matter subject to indemnification by you, in which case you agree to cooperate fully with our defense of such claims.
        </p>

        {/* 12 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">12. Termination</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>12.1 By Us.</strong> We reserve the right to suspend or terminate your access to the Service at any time, with or without cause or notice, at our sole discretion. Grounds for termination include, but are not limited to, violation of this Agreement, failure to pay applicable fees, submission of false information, or conduct we determine to be harmful to the Service, other users, or third parties.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>12.2 By You.</strong> You may discontinue use of the Service at any time. Attorneys wishing to deactivate their professional accounts may do so by contacting us at <a href="mailto:eclbk_legal@ahs.us.com" className="text-[#FCAA2D] underline">eclbk_legal@ahs.us.com</a>. Deactivation does not entitle you to a refund of any previously paid lead fees.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>12.3 Effect of Termination.</strong> Upon termination, your license to use the Service terminates immediately. Provisions of this Agreement that by their nature should survive termination (including but not limited to Sections 9, 10, 11, 13, and 14) shall survive.
        </p>

        {/* 13 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">13. Governing Law</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          This Agreement shall be governed by and construed in accordance with the laws of the State of New York, without regard to its conflict of law provisions. To the extent any court proceeding is permitted under this Agreement, you consent to the exclusive jurisdiction and venue of the state and federal courts located in New York County, New York.
        </p>

        {/* 14 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">14. Dispute Resolution and Arbitration</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>14.1 Informal Resolution.</strong> Before initiating any formal dispute, you agree to first contact us at <a href="mailto:eclbk_legal@ahs.us.com" className="text-[#FCAA2D] underline">eclbk_legal@ahs.us.com</a> and attempt to resolve the dispute informally. We will use reasonable efforts to resolve the dispute within thirty (30) days of receiving notice.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>14.2 Binding Arbitration.</strong> If the parties are unable to resolve the dispute informally, any dispute, claim, or controversy arising out of or relating to this Agreement or the Service shall be resolved by binding arbitration administered by the American Arbitration Association ("AAA") under its Consumer Arbitration Rules. The arbitration shall be conducted in New York, New York, or remotely if agreed by both parties. The arbitrator's decision shall be final and binding and may be entered as a judgment in any court of competent jurisdiction.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>14.3 Class Action Waiver.</strong> YOU AND WE AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR OUR INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING. No arbitration or proceeding shall be joined, consolidated, or combined with another without the prior written consent of all parties.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>14.4 Exceptions.</strong> Notwithstanding the foregoing, either party may seek emergency injunctive or other equitable relief in a court of competent jurisdiction to prevent irreparable harm pending arbitration. Claims for unpaid lead fees under $500 may be brought in small claims court.
        </p>

        {/* 15 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">15. Changes to This Agreement</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          We reserve the right to modify this Agreement at any time. If we make material changes, we will provide notice through the Service interface or by email to the address associated with your account at least fourteen (14) days before the changes take effect, except where immediate changes are required by law or to address security vulnerabilities. Your continued use of the Service after the effective date of any modification constitutes your acceptance of the revised Agreement. If you do not agree to the modified terms, you must stop using the Service.
        </p>

        {/* 16 */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">16. Miscellaneous</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>Entire Agreement.</strong> This Agreement, together with our Privacy Policy and Cookie Policy, constitutes the entire agreement between you and us with respect to the Service and supersedes all prior and contemporaneous agreements, understandings, and representations.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>Severability.</strong> If any provision of this Agreement is found to be unenforceable, the remaining provisions shall remain in full force and effect, and the unenforceable provision shall be modified to the minimum extent necessary to make it enforceable.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>Waiver.</strong> No waiver of any term of this Agreement shall be deemed a further or continuing waiver of that term or any other term.
        </p>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          <strong>Assignment.</strong> You may not assign your rights or obligations under this Agreement without our prior written consent. We may assign this Agreement freely, including in connection with a merger, acquisition, or sale of assets.
        </p>

        {/* Contact */}
        <h2 className="text-xl font-semibold text-[#191918] mb-3 mt-8">17. Contact</h2>
        <p className="text-[rgba(25,25,24,0.7)] leading-relaxed mb-4 text-sm">
          Questions about this Agreement should be directed to:
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
