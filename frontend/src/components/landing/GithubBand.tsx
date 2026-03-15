export default function GithubBand() {
  return (
    <section className="bg-[#FFFEF2] border-y border-[rgba(25,25,24,0.12)] px-4 sm:px-6 py-14">
      <div className="max-w-3xl mx-auto text-center">
        <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-3">
          Open Source
        </p>
        <h2 className="text-2xl font-bold text-[#191918] mb-4">Built in the open</h2>
        <p className="text-[rgba(25,25,24,0.6)] mb-6">
          The matching engine, scoring logic, and docket integration are all open source. Audit the AI, fork it, or contribute.
        </p>
        <a
          href="https://github.com/peterzhang12312-jpg/attorney-matchmaker"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-[rgba(25,25,24,0.12)] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide px-6 min-h-[44px] hover:border-[#FCAA2D] transition-colors"
        >
          Star on GitHub
        </a>
      </div>
    </section>
  );
}
