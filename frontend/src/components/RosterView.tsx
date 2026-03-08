import { useState, useEffect, useCallback } from "react";
import { Users, RefreshCw, MapPin } from "lucide-react";
import type { Attorney } from "../types/api";
import { fetchAttorneys } from "../api/client";
import SkeletonCard from "./SkeletonCard";

/* Dropdown options derived from common values in the dataset */
const JURISDICTIONS = [
  { value: "", label: "All Jurisdictions" },
  { value: "cacd", label: "C.D. Cal." },
  { value: "cand", label: "N.D. Cal." },
  { value: "cal", label: "Cal. State" },
  { value: "calctapp", label: "Cal. Ct. App." },
  { value: "nyed", label: "E.D.N.Y." },
  { value: "nysd", label: "S.D.N.Y." },
  { value: "ny", label: "N.Y. State" },
];

const SPECIALIZATIONS = [
  { value: "", label: "All Specializations" },
  { value: "Employment Law", label: "Employment Law" },
  { value: "Intellectual Property", label: "Intellectual Property" },
  { value: "Contract Law", label: "Contract Law" },
  { value: "Personal Injury", label: "Personal Injury" },
  { value: "Civil Rights", label: "Civil Rights" },
  { value: "Corporate Law", label: "Corporate Law" },
  { value: "Real Estate", label: "Real Estate" },
  { value: "Criminal Defense", label: "Criminal Defense" },
  { value: "Immigration", label: "Immigration" },
  { value: "Family Law", label: "Family Law" },
];

const AVAILABILITY_OPTIONS = [
  { value: "", label: "Any Availability" },
  { value: "available", label: "Available" },
  { value: "limited", label: "Limited" },
  { value: "unavailable", label: "Unavailable" },
];

function availabilityDot(avail: string): string {
  switch (avail) {
    case "available":
      return "bg-emerald-400";
    case "limited":
      return "bg-amber-400";
    case "unavailable":
      return "bg-red-400";
    default:
      return "bg-gray-400";
  }
}

export default function RosterView() {
  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Filters */
  const [jurisdiction, setJurisdiction] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [availability, setAvailability] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAttorneys({
        jurisdiction: jurisdiction || undefined,
        specialization: specialization || undefined,
        availability: availability || undefined,
      });
      setAttorneys(data.attorneys);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attorneys");
    } finally {
      setLoading(false);
    }
  }, [jurisdiction, specialization, availability]);

  useEffect(() => {
    load();
  }, [load]);

  const selectClasses =
    "bg-white border border-[rgba(25,25,24,0.12)] rounded-lg px-3 py-2 text-sm text-[#191918] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/30 focus:border-[#FCAA2D]";

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-[#FCAA2D]" />
        <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">Attorney Roster</h2>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
          className={selectClasses}
        >
          {JURISDICTIONS.map((j) => (
            <option key={j.value} value={j.value}>
              {j.label}
            </option>
          ))}
        </select>

        <select
          value={specialization}
          onChange={(e) => setSpecialization(e.target.value)}
          className={selectClasses}
        >
          {SPECIALIZATIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          className={selectClasses}
        >
          {AVAILABILITY_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[rgba(25,25,24,0.45)] hover:text-[#191918] bg-white border border-[rgba(25,25,24,0.12)] hover:border-[rgba(25,25,24,0.22)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Table */}
      {!loading && attorneys.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[rgba(25,25,24,0.12)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[rgba(25,25,24,0.02)] text-left">
                <th className="px-4 py-3 font-mono text-[0.65rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest">
                  Name
                </th>
                <th className="px-4 py-3 font-mono text-[0.65rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest">
                  Firm
                </th>
                <th className="px-4 py-3 font-mono text-[0.65rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest">
                  Jurisdictions
                </th>
                <th className="px-4 py-3 font-mono text-[0.65rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest">
                  Specializations
                </th>
                <th className="px-4 py-3 font-mono text-[0.65rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest text-right">
                  Exp.
                </th>
                <th className="px-4 py-3 font-mono text-[0.65rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest text-right">
                  Win Rate
                </th>
                <th className="px-4 py-3 font-mono text-[0.65rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest text-center">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(25,25,24,0.06)]">
              {attorneys.map((a) => (
                <tr
                  key={a.id}
                  className="hover:bg-[rgba(25,25,24,0.02)] transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {a.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {a.firm}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {a.jurisdictions.map((j) => (
                        <span
                          key={j}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[rgba(25,25,24,0.05)] text-[rgba(25,25,24,0.6)]"
                        >
                          <MapPin className="h-2.5 w-2.5" />
                          {j}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {a.specializations.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[rgba(252,170,45,0.1)] text-[#191918]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                    {a.years_experience} yrs
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                    {Math.round(a.win_rate * 100)}%
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${availabilityDot(a.availability)}`}
                      />
                      <span className="text-xs text-gray-500 capitalize">
                        {a.availability}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && attorneys.length === 0 && !error && (
        <div className="rounded-xl border border-[rgba(25,25,24,0.12)] bg-[rgba(25,25,24,0.02)] p-8 text-center">
          <p className="text-sm text-gray-500">
            No attorneys found matching the current filters.
          </p>
        </div>
      )}
    </div>
  );
}
