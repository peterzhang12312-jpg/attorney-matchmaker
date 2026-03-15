import { Link } from "react-router-dom";

export default function HeroBlock() {
  return (
    <section className="bg-[#FFFEF2] px-4 sm:px-6 pt-20 pb-24 text-center animate-fade-in">
      <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-4">
        AI-Powered Legal Matching
      </p>
      <h1 className="text-4xl sm:text-6xl font-bold text-[#191918] leading-tight mb-6 max-w-3xl mx-auto">
        Find the right attorney<br />in minutes.
      </h1>
      <p className="text-lg text-[rgba(25,25,24,0.6)] max-w-xl mx-auto mb-10">
        Matched from real court docket data — not pay-to-play rankings. Covering NY &amp; CA federal and state courts.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/app"
          className="rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide px-8 min-h-[44px] flex items-center justify-center"
        >
          Describe Your Case →
        </Link>
        <a
          href="#for-attorneys"
          className="rounded-md border border-[rgba(25,25,24,0.12)] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide px-8 min-h-[44px] flex items-center justify-center hover:border-[#FCAA2D] transition-colors"
        >
          For Attorneys
        </a>
      </div>
    </section>
  );
}
