import { useState } from "react";
import { lookupCase } from "../api/client";
import type { CaseLookupResponse, CaseLookupAttorney } from "../types/api";
import LandingNav from "../components/landing/LandingNav";
import LandingFooter from "../components/landing/LandingFooter";
import CaseSearchBox from "../components/caselookup/CaseSearchBox";
import CaseResultCard from "../components/caselookup/CaseResultCard";
import CaseAttorneyCard from "../components/caselookup/CaseAttorneyCard";
import MotionTimelineModal from "../components/caselookup/MotionTimelineModal";

export default function CaseLookupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaseLookupResponse | null>(null);
  const [selectedAttorney, setSelectedAttorney] = useState<CaseLookupAttorney | null>(null);

  async function handleSearch(query: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await lookupCase(query);
      setResult(data);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : null) || "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <LandingNav />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-3">
            Case Intelligence
          </p>
          <h1 className="text-4xl font-bold text-[#191918] mb-3">Search by similar case</h1>
          <p className="text-[rgba(25,25,24,0.6)] max-w-xl">
            Enter a docket number, case name, or describe a similar case. We'll pull the full motion timeline, explain what each filing means, and show you attorneys with matching expertise.
          </p>
        </div>

        <CaseSearchBox onSearch={handleSearch} loading={loading} />

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-[10px] p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-10 text-center">
            <div className="inline-block w-6 h-6 border-2 border-[#FCAA2D] border-t-transparent rounded-full animate-spin" />
            <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mt-3">
              Searching CourtListener + running AI analysis...
            </p>
          </div>
        )}

        {result && (
          <div className="mt-10 space-y-8 animate-fade-in">
            <CaseResultCard
              caseMeta={result.case}
              caseSummary={result.case_summary}
              similarity={result.similarity}
              queryType={result.query_type}
            />

            {result.attorneys.length > 0 ? (
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-4">
                  Attorneys in this case ({result.attorneys.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {result.attorneys.map((atty) => (
                    <CaseAttorneyCard
                      key={atty.name}
                      attorney={atty}
                      onViewTimeline={() => setSelectedAttorney(atty)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6 text-center text-sm text-[rgba(25,25,24,0.5)]">
                No attorney data found for this case. CourtListener RECAP data may be incomplete.
              </div>
            )}

            <div className="bg-[#FCAA2D] rounded-[10px] p-6 text-center">
              <p className="font-semibold text-[#191918] mb-1">Want an attorney with this expertise?</p>
              <p className="text-sm text-[rgba(25,25,24,0.65)] mb-4">
                Describe your case and get matched to attorneys available now.
              </p>
              <a href="/app" className="inline-flex items-center rounded-md bg-[#191918] text-[#FFFEF2] font-mono text-[0.7rem] uppercase tracking-wide px-6 min-h-[44px]">
                Get Matched
              </a>
            </div>
          </div>
        )}
      </main>

      <LandingFooter />

      {selectedAttorney && (
        <MotionTimelineModal
          attorney={selectedAttorney}
          onClose={() => setSelectedAttorney(null)}
        />
      )}
    </div>
  );
}
