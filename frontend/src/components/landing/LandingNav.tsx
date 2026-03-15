import { Link } from "react-router-dom";

export default function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 bg-[#FFFEF2] border-b border-[rgba(25,25,24,0.12)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="font-mono text-[0.8rem] uppercase tracking-widest text-[#191918] font-semibold">
          Attorney Matchmaker
        </Link>
        <div className="hidden sm:flex items-center gap-6">
          <a href="#how-it-works" className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors">
            How It Works
          </a>
          <a href="#for-attorneys" className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors">
            For Attorneys
          </a>
          <Link to="/blog" className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors">
            Blog
          </Link>
          <Link to="/case-lookup" className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors">
            Case Lookup
          </Link>
          <Link to="/coverage" className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors">
            Coverage
          </Link>
          <Link to="/dashboard" className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors">
            My Cases
          </Link>
        </div>
        <Link
          to="/app"
          className="rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide px-4 min-h-[44px] flex items-center"
        >
          Get Matched →
        </Link>
      </div>
    </nav>
  );
}
