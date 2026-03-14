import { useState, useEffect, useCallback } from "react";
import { Trophy, RefreshCw } from "lucide-react";
import type { LeaderboardResponse } from "../types/api";
import { fetchLeaderboard } from "../api/client";
import LeaderboardCard from "./LeaderboardCard";
import LeaderboardAuditPanel from "./LeaderboardAuditPanel";
import SkeletonCard from "./SkeletonCard";

const DOMAINS = [
  { value: "intellectual_property", label: "Intellectual Property" },
  { value: "real_estate",           label: "Real Estate" },
  { value: "corporate",             label: "Corporate" },
  { value: "employment",            label: "Employment" },
];

const JURISDICTIONS = [
  { value: "CA+NY", label: "CA + NY" },
  { value: "CA",    label: "California" },
  { value: "NY",    label: "New York" },
];

export default function LeaderboardView() {
  const [domain, setDomain] = useState("intellectual_property");
  const [jurisdiction, setJurisdiction] = useState("CA+NY");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLeaderboard({ domain, jurisdiction, top_n: 10, include_audit: true });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [domain, jurisdiction]);

  useEffect(() => { load(); }, [load]);

  const selectClasses =
    "bg-white border border-[rgba(25,25,24,0.12)] rounded-lg px-3 py-2 text-sm text-[#191918] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/30 focus:border-[#FCAA2D]";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 mr-2">
          <Trophy className="h-5 w-5 text-[#FCAA2D]" />
          <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">Attorney Rankings</h2>
        </div>

        <select value={domain} onChange={(e) => setDomain(e.target.value)} className={`${selectClasses} min-h-[44px] w-full sm:w-auto`}>
          {DOMAINS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>

        <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className={`${selectClasses} min-h-[44px] w-full sm:w-auto`}>
          {JURISDICTIONS.map((j) => (
            <option key={j.value} value={j.value}>{j.label}</option>
          ))}
        </select>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] w-full sm:w-auto rounded-lg text-xs font-medium text-[rgba(25,25,24,0.45)] hover:text-[#191918] bg-white border border-[rgba(25,25,24,0.12)] hover:border-[rgba(25,25,24,0.22)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Metadata */}
      {data && !loading && (
        <p className="text-xs text-gray-400">
          {data.entries.length} attorneys ranked · Generated {new Date(data.generated_at).toLocaleTimeString()} · Cached {data.cache_ttl_minutes} min
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Audit panel */}
      {!loading && data?.audit && (
        <LeaderboardAuditPanel audit={data.audit} />
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Entries */}
      {!loading && data && data.entries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.entries.map((entry) => (
            <LeaderboardCard
              key={entry.attorney.id}
              entry={entry}
              isTopPick={data.audit?.top_pick === entry.attorney.name}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && data && data.entries.length === 0 && (
        <div className="rounded-xl border border-[rgba(25,25,24,0.12)] bg-[rgba(25,25,24,0.02)] p-8 text-center">
          <p className="text-sm text-gray-500">No attorneys found for this domain and jurisdiction combination.</p>
        </div>
      )}
    </div>
  );
}
