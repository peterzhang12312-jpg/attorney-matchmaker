const features = [
  { icon: "⚖️", title: "AI Scoring", desc: "Claude Opus audits every match. Gemini 2.5 Flash analyzes your facts." },
  { icon: "📋", title: "Real Docket Data", desc: "Attorneys ranked from CourtListener federal docket records — not self-reported stats." },
  { icon: "📍", title: "Venue Optimizer", desc: "AI identifies the optimal court venue for your case type and facts." },
  { icon: "💵", title: "Budget Matching", desc: "Filter attorneys by hourly rate ceiling. No surprises." },
  { icon: "🏛️", title: "16 Practice Areas", desc: "From real estate to immigration, criminal defense to IP litigation." },
  { icon: "✅", title: "Live Verification", desc: "CourtListener lookup with NYSCEF manual verification link for every attorney." },
];

export default function FeaturesGrid() {
  return (
    <section className="bg-[#FFFEF2] px-4 sm:px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-3 text-center">
          What Makes It Different
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#191918] text-center mb-14">
          Built on data, not dollars
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-[#191918] mb-2">{f.title}</h3>
              <p className="text-sm text-[rgba(25,25,24,0.6)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
