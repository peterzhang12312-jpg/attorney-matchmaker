import { Link } from "react-router-dom";

export default function ForAttorneys() {
  return (
    <section id="for-attorneys" className="bg-[#FCAA2D] px-4 sm:px-6 py-20">
      <div className="max-w-3xl mx-auto text-center">
        <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.55)] mb-4">
          For Attorneys
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#191918] mb-4">
          Join 20+ founding attorneys
        </h2>
        <p className="text-[rgba(25,25,24,0.7)] mb-10 max-w-xl mx-auto">
          Get qualified leads delivered directly. No monthly subscription — pay only per matched lead. Founding members get a permanent badge and priority placement.
        </p>
        <Link
          to="/app"
          onClick={() => setTimeout(() => {
            document.getElementById("attorney-tab")?.click();
          }, 100)}
          className="inline-flex items-center rounded-md bg-[#191918] text-[#FFFEF2] font-mono text-[0.7rem] uppercase tracking-wide px-8 min-h-[44px]"
        >
          Apply as a Founding Attorney →
        </Link>
      </div>
    </section>
  );
}
