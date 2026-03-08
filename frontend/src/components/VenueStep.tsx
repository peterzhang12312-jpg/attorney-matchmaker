/* ------------------------------------------------------------------ */
/*  VenueStep — Step 2 of the 6-step intake wizard                    */
/*  Captures: county (NY only), party locations, federal triggers,    */
/*  and procedural mechanisms.                                        */
/* ------------------------------------------------------------------ */

interface VenueStepProps {
  jurisdictions: string[];
  county: string;
  plaintiffLocation: string;
  defendantLocation: string;
  federalQuestion: boolean;
  proceduralFlags: string[];
  onCountyChange: (val: string) => void;
  onPlaintiffLocationChange: (val: string) => void;
  onDefendantLocationChange: (val: string) => void;
  onFederalQuestionChange: (val: boolean) => void;
  onProceduralFlagsChange: (val: string[]) => void;
}

const NY_COURTS = new Set(["ny", "nyed", "nysd"]);

const NY_COUNTIES = [
  { value: "Queens", label: "Queens" },
  { value: "Kings", label: "Kings (Brooklyn)" },
  { value: "Bronx", label: "Bronx" },
  { value: "New York", label: "New York (Manhattan)" },
  { value: "Richmond", label: "Richmond (Staten Island)" },
  { value: "Other", label: "Other / Statewide" },
];

const PROCEDURAL_OPTIONS = [
  { value: "interpleader", label: "Statutory Interpleader", cite: "28 U.S.C. § 1335" },
  { value: "intervention", label: "Intervention", cite: "Fed. R. Civ. P. 24" },
  { value: "venue_challenge", label: "Venue Challenge", cite: "28 U.S.C. § 1391 / CPLR § 509" },
  { value: "none", label: "None applicable", cite: "" },
];

function extractState(location: string): string {
  const parts = location.trim().split(",");
  if (parts.length >= 2) return parts[parts.length - 1].trim().toUpperCase();
  return location.trim().toUpperCase();
}

function isDiversityEligible(plaintiff: string, defendant: string): boolean {
  if (!plaintiff.trim() || !defendant.trim()) return false;
  const ps = extractState(plaintiff);
  const ds = extractState(defendant);
  return ps.length > 0 && ds.length > 0 && ps !== ds;
}

export default function VenueStep({
  jurisdictions,
  county,
  plaintiffLocation,
  defendantLocation,
  federalQuestion,
  proceduralFlags,
  onCountyChange,
  onPlaintiffLocationChange,
  onDefendantLocationChange,
  onFederalQuestionChange,
  onProceduralFlagsChange,
}: VenueStepProps) {
  const hasNY = jurisdictions.some((j) => NY_COURTS.has(j));
  const diversity = isDiversityEligible(plaintiffLocation, defendantLocation);

  function toggleProceduralFlag(value: string) {
    if (value === "none") {
      // "None" clears all others
      onProceduralFlagsChange(proceduralFlags.includes("none") ? [] : ["none"]);
      return;
    }
    // Any real flag clears "none"
    const without = proceduralFlags.filter((f) => f !== "none");
    if (without.includes(value)) {
      onProceduralFlagsChange(without.filter((f) => f !== value));
    } else {
      onProceduralFlagsChange([...without, value]);
    }
  }

  return (
    <div className="space-y-8">
      {/* ---- County (NY only) ---- */}
      {hasNY && (
        <div>
          <label className="block font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-2">
            County / Venue
          </label>
          <select
            value={county}
            onChange={(e) => onCountyChange(e.target.value)}
            className="w-full rounded-xl bg-white border border-[rgba(25,25,24,0.12)] px-3 py-2.5 text-sm text-[#191918] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/30 focus:border-[#FCAA2D]"
          >
            <option value="">Select county (optional)</option>
            {NY_COUNTIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ---- Party Locations ---- */}
      <div>
        <label className="block font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-1">
          Party Locations
        </label>
        <p className="text-xs text-gray-400 mb-3">
          Used to assess diversity jurisdiction eligibility (28 U.S.C. § 1332).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Plaintiff Location</label>
            <input
              type="text"
              value={plaintiffLocation}
              onChange={(e) => onPlaintiffLocationChange(e.target.value)}
              placeholder="e.g. New York, NY"
              className="w-full rounded-xl bg-white border border-[rgba(25,25,24,0.12)] px-3 py-2.5 text-sm text-[#191918] placeholder-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/30 focus:border-[#FCAA2D]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Defendant Location</label>
            <input
              type="text"
              value={defendantLocation}
              onChange={(e) => onDefendantLocationChange(e.target.value)}
              placeholder="e.g. Los Angeles, CA"
              className="w-full rounded-xl bg-white border border-[rgba(25,25,24,0.12)] px-3 py-2.5 text-sm text-[#191918] placeholder-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/30 focus:border-[#FCAA2D]"
            />
          </div>
        </div>

        {/* Diversity badge */}
        {diversity && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
            <span className="text-amber-600 text-sm mt-0.5">⚠</span>
            <div>
              <p className="text-xs font-semibold text-amber-700">Potential Diversity Jurisdiction</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Parties appear to be in different states — federal diversity jurisdiction may apply
                (28 U.S.C. § 1332, amounts &gt; $75k).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ---- Federal Triggers ---- */}
      <div>
        <label className="block font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-3">
          Federal Jurisdiction Triggers
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={federalQuestion}
            onChange={(e) => onFederalQuestionChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#FCAA2D] focus:ring-[#FCAA2D]/30 focus:ring-2 accent-[#FCAA2D]"
          />
          <div>
            <span className="text-sm font-medium text-gray-800">Federal Question</span>
            <span className="ml-2 text-xs text-gray-400">28 U.S.C. § 1331</span>
            <p className="text-xs text-gray-500 mt-0.5">
              A federal statute, constitutional provision, or treaty is at issue.
            </p>
          </div>
        </label>
      </div>

      {/* ---- Procedural Mechanisms ---- */}
      <div>
        <label className="block font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-3">
          Procedural Mechanisms
        </label>
        <div className="flex flex-wrap gap-2">
          {PROCEDURAL_OPTIONS.map((opt) => {
            const active = proceduralFlags.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleProceduralFlag(opt.value)}
                className={`inline-flex flex-col items-start px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                  active
                    ? "bg-[#FCAA2D] text-[#191918] border-[#FCAA2D]"
                    : "bg-white text-[rgba(25,25,24,0.5)] border-[rgba(25,25,24,0.12)] hover:border-[rgba(252,170,45,0.4)] hover:text-[#191918]"
                }`}
              >
                <span>{opt.label}</span>
                {opt.cite && (
                  <span className={`text-[10px] mt-0.5 ${active ? "text-blue-100" : "text-gray-400"}`}>
                    {opt.cite}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
