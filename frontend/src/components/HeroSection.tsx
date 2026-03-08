import { FileText, BookOpen, Scale } from "lucide-react";

const pills = [
  {
    icon: FileText,
    label: "RECAP Dockets",
    description: "Real federal courtroom track records",
  },
  {
    icon: BookOpen,
    label: "Harvard CAP Opinions",
    description: "10 years of landmark published wins",
  },
  {
    icon: Scale,
    label: "Zero Directory Bias",
    description: "Pure algorithmic scoring. No paid placements.",
  },
];

export default function HeroSection() {
  return (
    <div className="bg-[#FFFEF2] border-b border-[rgba(25,25,24,0.05)] py-10 text-center animate-fade-in">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#191918] leading-tight mb-3">
          Objective{" "}
          <span className="text-[#FCAA2D]">Math.</span>
          <br />
          Not Paid Listings.
        </h1>

        <p className="text-[rgba(25,25,24,0.45)] text-base mb-7">
          AI-powered matching using real federal court records
          <br className="hidden sm:block" />
          {" "}— not who paid for top billing.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-7">
          {pills.map(({ icon: Icon, label, description }) => (
            <div
              key={label}
              title={description}
              className="border border-[rgba(252,170,45,0.3)] rounded-full px-3 py-1.5 text-xs text-[rgba(25,25,24,0.55)] flex items-center gap-1.5 cursor-default"
            >
              <Icon size={13} className="text-[#FCAA2D] shrink-0" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-[#FCAA2D] font-mono uppercase tracking-wide">
          Describe your case below
        </p>
      </div>
    </div>
  );
}
