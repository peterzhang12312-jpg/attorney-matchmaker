import { useEffect, useState } from "react";
import LandingNav from "../components/landing/LandingNav";
import LandingFooter from "../components/landing/LandingFooter";
import DensityMap from "../components/coverage/DensityMap";
import type { StateStats } from "../components/coverage/DensityMap";

export default function CoveragePage() {
  const [states, setStates] = useState<Record<string, StateStats>>({});
  const [selected, setSelected] = useState<{ abbrev: string; stats: StateStats } | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    fetch("/api/coverage/stats")
      .then((r) => r.json())
      .then((d) => setStates(d.states || {}))
      .catch(() => {});
  }, []);

  async function handleRequestCoverage() {
    if (!selected) return;
    setRequesting(true);
    await fetch("/api/coverage/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: selected.abbrev, email: requestEmail || null }),
    });
    setRequesting(false);
    setRequestSent(true);
  }

  const totalAttorneys = Object.values(states).reduce((s, v) => s + v.count, 0);
  const coveredStates = Object.values(states).filter((s) => s.count > 0).length;

  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <LandingNav />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-3">
          Attorney Coverage
        </p>
        <h1 className="text-4xl font-bold text-[#191918] mb-3">Coverage Map</h1>
        <p className="text-[rgba(25,25,24,0.6)] mb-8 max-w-xl">
          See where attorneys are available. Green = 5+ attorneys, amber = 1-4, red = none yet.
        </p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {(
            [
              ["Total Attorneys", totalAttorneys],
              ["States Covered", coveredStates],
              ["Federal Courts", "92"],
            ] as [string, number | string][]
          ).map(([label, value]) => (
            <div
              key={label}
              className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-4 text-center"
            >
              <p className="text-2xl font-bold text-[#191918]">{value}</p>
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-1">
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <DensityMap
              states={states}
              onSelectState={(abbrev, stats) => {
                setSelected({ abbrev, stats });
                setRequestSent(false);
              }}
              selectedState={selected?.abbrev || null}
            />
          </div>

          {selected && (
            <div className="lg:w-72 bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5 h-fit">
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-1">
                {selected.abbrev}
              </p>
              <p className="text-xl font-bold text-[#191918] mb-3">
                {selected.stats.count} attorney{selected.stats.count !== 1 ? "s" : ""} available
              </p>

              <div className="space-y-2 mb-4">
                <div>
                  <p className="font-mono text-[0.6rem] uppercase tracking-widest text-[rgba(25,25,24,0.4)]">
                    Primary Court
                  </p>
                  <p className="text-sm text-[#191918]">{selected.stats.primary_court_label}</p>
                </div>
                <div>
                  <p className="font-mono text-[0.6rem] uppercase tracking-widest text-[rgba(25,25,24,0.4)]">
                    Data Coverage
                  </p>
                  <span
                    className={`text-xs font-mono uppercase px-2 py-0.5 rounded ${
                      selected.stats.coverage === "full"
                        ? "bg-green-100 text-green-700"
                        : selected.stats.coverage === "partial"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {selected.stats.coverage}
                  </span>
                </div>
              </div>

              {selected.stats.count === 0 && !requestSent && (
                <div>
                  <p className="text-sm text-[rgba(25,25,24,0.6)] mb-2">
                    No attorneys yet. Request coverage:
                  </p>
                  <input
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    placeholder="your@email.com (optional)"
                    className="w-full border border-[rgba(25,25,24,0.12)] rounded px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[#FCAA2D]"
                  />
                  <button
                    onClick={handleRequestCoverage}
                    disabled={requesting}
                    className="w-full rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.65rem] uppercase tracking-wide min-h-[36px] disabled:opacity-50"
                  >
                    {requesting ? "Sending..." : "Request Coverage"}
                  </button>
                </div>
              )}
              {requestSent && (
                <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-2">
                  Request logged. We'll expand here soon.
                </p>
              )}
            </div>
          )}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
