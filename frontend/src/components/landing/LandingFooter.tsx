import { Link } from "react-router-dom";

export default function LandingFooter() {
  return (
    <footer className="bg-[#FFFEF2] border-t border-[rgba(25,25,24,0.12)] px-4 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">
          © 2026 Attorney Matchmaker
        </span>
        <div className="flex items-center gap-6">
          <a href="https://www.linkedin.com/company/attorney-matchmaker" target="_blank" rel="noopener noreferrer" className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors">LinkedIn</a>
          <a href="https://github.com/peterzhang12312-jpg/attorney-matchmaker" target="_blank" rel="noopener noreferrer" className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors">GitHub</a>
          <Link to="/blog" className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors">Blog</Link>
          <Link to="/privacy" className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors">Privacy</Link>
          <Link to="/eula" className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors">Terms</Link>
          <Link to="/cookie-policy" className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors">Cookies</Link>
        </div>
      </div>
    </footer>
  );
}
