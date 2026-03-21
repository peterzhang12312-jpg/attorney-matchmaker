const steps = [
  { n: "01", title: "Describe Your Case", desc: "Tell us the facts, urgency, and budget. Takes 2 minutes." },
  { n: "02", title: "AI Analyzes Dockets", desc: "Gemini extracts case type and keywords. We query CourtListener for attorneys with real docket history." },
  { n: "03", title: "Get Matched Attorneys", desc: "Attorneys ranked by AI score, budget fit, and verified court experience." },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white border-y border-[rgba(25,25,24,0.12)] px-4 sm:px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-3 text-center">
          The Process
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#191918] text-center mb-14">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
          {steps.map((s, i) => (
            <div key={s.n} className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#FCAA2D] flex items-center justify-center font-mono text-[0.8rem] font-bold text-[#191918] mb-4">
                {s.n}
              </div>
              {i < steps.length - 1 && (
                <div className="hidden sm:block absolute top-6 left-1/3 w-1/3 h-0.5 bg-[rgba(25,25,24,0.12)]" />
              )}
              <h3 className="text-lg font-semibold text-[#191918] mb-2">{s.title}</h3>
              <p className="text-[rgba(25,25,24,0.6)] text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
