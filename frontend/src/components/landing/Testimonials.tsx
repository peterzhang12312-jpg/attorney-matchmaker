const testimonials = [
  { quote: "Found an attorney in 10 minutes who had actually won a similar SDNY case. Hired him.", author: "Queens real estate developer" },
  { quote: "I was skeptical of AI matching, but the docket data made the difference. My attorney knew the judge.", author: "IP plaintiff, CACD" },
  { quote: "Finally a tool that shows court records, not just a Yelp-style rating.", author: "Small business owner, NYC" },
];

export default function Testimonials() {
  return (
    <section className="bg-white border-y border-[rgba(25,25,24,0.12)] px-4 sm:px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-3 text-center">
          What Clients Say
        </p>
        <h2 className="text-3xl font-bold text-[#191918] text-center mb-14">
          Real results, real cases
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {testimonials.map((t) => (
            <div key={t.author} className="bg-[#FFFEF2] border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
              <p className="text-[#191918] leading-relaxed mb-4">"{t.quote}"</p>
              <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">— {t.author}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
