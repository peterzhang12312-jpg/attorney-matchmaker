import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function ComplaintPage() {
  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <Helmet>
        <title>Complaints & Feedback — Attorney Matchmaker</title>
        <meta name="description" content="Submit a complaint or feedback about Attorney Matchmaker or an attorney referred through our service." />
      </Helmet>

      <nav className="border-b border-[rgba(25,25,24,0.12)] bg-white px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-mono text-sm font-semibold text-[#191918] tracking-wide">
          Attorney Matchmaker
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-[#FCAA2D] mb-3">
          Complaints & Feedback
        </p>
        <h1 className="text-3xl font-bold text-[#191918] mb-6">
          Submit a Complaint
        </h1>

        {/* Required CA State Bar complaint language */}
        <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6 mb-8">
          <p className="text-sm text-[rgba(25,25,24,0.65)] leading-relaxed">
            If you have a complaint about the conduct of this attorney matching service
            or any attorney connected to you through Attorney Matchmaker, you may submit
            your complaint to us using the contact information below. Any unresolved
            complaints may be submitted to the{" "}
            <a
              href="https://www.calbar.ca.gov/public/discipline/file-complaint"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FCAA2D] hover:underline"
            >
              State Bar of California
            </a>
            {" "}or your state's bar association.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
            <h2 className="font-mono text-xs uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-3">
              Contact Us
            </h2>
            <p className="text-sm text-[rgba(25,25,24,0.65)] mb-2">
              Email your complaint to:{" "}
              <a href="mailto:peter.zhang12312@gmail.com" className="text-[#FCAA2D] hover:underline">
                peter.zhang12312@gmail.com
              </a>
            </p>
            <p className="text-sm text-[rgba(25,25,24,0.65)]">
              Please include your case ID (if applicable), the attorney's name, and a
              description of your concern. We aim to respond within 5 business days.
            </p>
          </div>

          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
            <h2 className="font-mono text-xs uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-3">
              State Bar Resources
            </h2>
            <ul className="space-y-2 text-sm text-[rgba(25,25,24,0.65)]">
              <li>
                <a href="https://www.calbar.ca.gov/public/discipline/file-complaint" target="_blank" rel="noopener noreferrer" className="text-[#FCAA2D] hover:underline">
                  California State Bar — File a Complaint
                </a>
              </li>
              <li>
                <a href="https://www.nycourts.gov/attorneys/grievance/" target="_blank" rel="noopener noreferrer" className="text-[#FCAA2D] hover:underline">
                  New York — Attorney Grievance Committee
                </a>
              </li>
              <li>
                <a href="https://www.americanbar.org/groups/lawyer_referral/resources/state_bar_information/" target="_blank" rel="noopener noreferrer" className="text-[#FCAA2D] hover:underline">
                  Find Your State Bar
                </a>
              </li>
            </ul>
          </div>

          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
            <h2 className="font-mono text-xs uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-3">
              Important Notice
            </h2>
            <p className="text-sm text-[rgba(25,25,24,0.65)] leading-relaxed">
              Attorney Matchmaker is not a law firm and does not provide legal advice.
              We do not represent clients or attorneys in any legal matter. The attorney-client
              relationship is formed solely between you and the attorney you choose to work with.
              We are not responsible for the conduct of any attorney connected through our service.
            </p>
          </div>
        </div>

        <p className="mt-10 text-xs text-[rgba(25,25,24,0.35)] font-mono">
          <Link to="/privacy" className="hover:text-[#FCAA2D]">Privacy Policy</Link>
          {" · "}
          <Link to="/eula" className="hover:text-[#FCAA2D]">Terms of Use</Link>
        </p>
      </main>
    </div>
  );
}
