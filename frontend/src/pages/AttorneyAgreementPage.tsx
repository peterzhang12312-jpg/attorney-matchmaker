import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function AttorneyAgreementPage() {
  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <Helmet>
        <title>Attorney Participation Agreement — Attorney Matchmaker</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <nav className="border-b border-[rgba(25,25,24,0.12)] bg-white px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-mono text-sm font-semibold text-[#191918] tracking-wide">
          Attorney Matchmaker
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-[#FCAA2D] mb-3">
          Legal Agreement
        </p>
        <h1 className="text-3xl font-bold text-[#191918] mb-2">
          Attorney Participation Agreement
        </h1>
        <p className="text-sm text-[rgba(25,25,24,0.45)] font-mono mb-10">
          Effective upon registration. Last updated March 2026.
        </p>

        <div className="space-y-6 text-sm text-[rgba(25,25,24,0.65)] leading-relaxed">

          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
            <h2 className="font-mono text-xs uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-3">1. Nature of the Service</h2>
            <p>
              Attorney Matchmaker is operated by a licensed New York attorney ("Operator").
              This platform connects prospective clients with licensed attorneys based on
              objective criteria including practice area, geographic jurisdiction, and
              case type. The platform does not provide legal advice and does not form
              an attorney-client relationship with any user.
            </p>
          </div>

          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
            <h2 className="font-mono text-xs uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-3">2. Referral Fee Structure — NY Rule 1.5(g)</h2>
            <p className="mb-3">
              By registering on this platform, you ("Participating Attorney") acknowledge and agree that:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                Lead reveal fees paid to Attorney Matchmaker constitute referral fees
                between attorneys, governed by New York Rule of Professional Conduct 1.5(g).
              </li>
              <li>
                The total fee charged to any client will not be increased as a result
                of this referral arrangement.
              </li>
              <li>
                By accepting a lead, you assume responsibility for the representation
                and agree to disclose the referral arrangement to the client upon request.
              </li>
              <li>
                Fees are charged on a per-lead basis ($25–$75 depending on practice area)
                and do not constitute fee-sharing from legal fees earned.
              </li>
            </ul>
          </div>

          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
            <h2 className="font-mono text-xs uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-3">3. Attorney Eligibility</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>You must be an active, licensed attorney in good standing in at least one U.S. jurisdiction.</li>
              <li>You must maintain professional liability (malpractice) insurance appropriate for your practice.</li>
              <li>You agree to notify Attorney Matchmaker immediately if your bar license is suspended, revoked, or subject to disciplinary proceedings.</li>
            </ul>
          </div>

          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
            <h2 className="font-mono text-xs uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-3">4. No Endorsement</h2>
            <p>
              Attorney Matchmaker does not endorse, recommend, or guarantee the quality
              of any participating attorney. Match results are based solely on objective
              criteria — practice area alignment, jurisdiction, and availability. The
              platform makes no representation regarding an attorney's competence,
              experience, or fitness for any particular matter.
            </p>
          </div>

          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
            <h2 className="font-mono text-xs uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-3">5. Complaints & Removal</h2>
            <p>
              Attorney Matchmaker reserves the right to remove any attorney from the platform
              for cause, including client complaints, bar discipline, or failure to comply
              with this agreement. Attorneys subject to removal will receive written notice
              and an opportunity to respond before removal is finalized, except in cases
              of immediate risk to clients.
            </p>
            <p className="mt-3">
              To submit a complaint about a participating attorney:{" "}
              <a href="mailto:peter.zhang12312@gmail.com" className="text-[#FCAA2D] hover:underline">
                peter.zhang12312@gmail.com
              </a>
            </p>
          </div>

          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
            <h2 className="font-mono text-xs uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-3">6. Questions</h2>
            <p>
              Questions about this agreement or the platform:{" "}
              <a href="mailto:peter.zhang12312@gmail.com" className="text-[#FCAA2D] hover:underline">
                peter.zhang12312@gmail.com
              </a>
            </p>
          </div>

        </div>

        <p className="mt-10 text-xs text-[rgba(25,25,24,0.35)] font-mono">
          <Link to="/privacy" className="hover:text-[#FCAA2D]">Privacy Policy</Link>
          {" · "}
          <Link to="/eula" className="hover:text-[#FCAA2D]">Terms of Use</Link>
          {" · "}
          <Link to="/complaint" className="hover:text-[#FCAA2D]">Complaints</Link>
        </p>
      </main>
    </div>
  );
}
