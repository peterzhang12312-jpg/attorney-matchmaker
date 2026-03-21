import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export default function GetHelpPage() {
  return (
    <div className="min-h-screen bg-[#FFFEF2] flex flex-col items-center justify-center px-6">
      <Helmet>
        <title>Get Free Legal Help — Attorney Matchmaker</title>
        <meta
          name="description"
          content="Got a legal problem? Get matched with the right attorney in 2 minutes. Free, no commitment."
        />
      </Helmet>

      <div className="max-w-md w-full text-center">
        {/* Logo / brand */}
        <p className="font-mono text-xs uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-6">
          Attorney Matchmaker
        </p>

        <h1 className="text-4xl font-bold text-[#191918] mb-4 leading-tight">
          Got a legal problem?
        </h1>
        <p className="text-lg text-[rgba(25,25,24,0.65)] mb-10 leading-relaxed">
          Get matched with the right attorney in 2 minutes.
          <br />
          Free. No commitment.
        </p>

        <Link
          to="/app"
          className="block w-full rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-sm uppercase tracking-wide py-5 font-semibold hover:bg-amber-400 transition-colors text-center"
        >
          Start Free Match →
        </Link>

        <ul className="mt-10 space-y-3 text-sm text-[rgba(25,25,24,0.55)] text-left">
          <li className="flex items-start gap-3">
            <span className="text-[#FCAA2D] font-bold mt-0.5">✓</span>
            Describe your situation — we extract the legal issues automatically
          </li>
          <li className="flex items-start gap-3">
            <span className="text-[#FCAA2D] font-bold mt-0.5">✓</span>
            Matched based on real court record data, not who paid the most
          </li>
          <li className="flex items-start gap-3">
            <span className="text-[#FCAA2D] font-bold mt-0.5">✓</span>
            Attorney contacts you — you don't chase anyone
          </li>
        </ul>

        <p className="mt-10 text-xs text-[rgba(25,25,24,0.35)] font-mono">
          Personal injury · Criminal defense · Immigration · Family law · and more
        </p>
      </div>
    </div>
  );
}
