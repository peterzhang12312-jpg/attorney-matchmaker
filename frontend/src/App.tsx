import { useState, useEffect, useCallback } from "react";
import type { HealthResponse, MatchResponse } from "./types/api";
import { fetchHealth } from "./api/client";
import Header from "./components/Header";
import IntakeForm from "./components/IntakeForm";
import FactAnalysisPanel from "./components/FactAnalysisPanel";
import VenueRecommendationCard from "./components/VenueRecommendationCard";
import ResultsSection from "./components/ResultsSection";
import AuditSummary from "./components/AuditSummary";
import RosterView from "./components/RosterView";
import LeaderboardView from "./components/LeaderboardView";
import HeroSection from "./components/HeroSection";

export type Tab = "find" | "roster" | "leaderboard";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("find");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResponse | null>(null);

  /* Poll health on mount */
  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch(() => {
        /* backend unreachable — status pill will show nothing */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMatchComplete = useCallback((result: MatchResponse) => {
    setMatchResult(result);
  }, []);

  const handleReset = useCallback(() => {
    setMatchResult(null);
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFEF2] flex flex-col">
      <Header
        health={health}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Find tab: intake slides or results */}
      {activeTab === "find" && matchResult === null && (
        <div className="flex-1 flex flex-col">
          <HeroSection />
          <IntakeForm onMatchComplete={handleMatchComplete} />
        </div>
      )}

      {activeTab === "find" && matchResult !== null && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <button
              type="button"
              onClick={handleReset}
              className="text-sm text-[#FCAA2D] hover:text-amber-600 transition-colors font-mono text-[0.7rem] uppercase tracking-wide"
            >
              &larr; New Search
            </button>

            <FactAnalysisPanel
              analysis={matchResult.gemini_analysis}
              durationMs={matchResult.pipeline_duration_ms}
              warnings={matchResult.warnings}
            />

            {matchResult.venue_recommendation && (
              <VenueRecommendationCard
                recommendation={matchResult.venue_recommendation}
              />
            )}

            <ResultsSection
              matches={matchResult.matches}
              audit={matchResult.audit}
            />

            {matchResult.audit && (
              <AuditSummary audit={matchResult.audit} />
            )}
          </div>
        </main>
      )}

      {/* Roster tab */}
      {activeTab === "roster" && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <RosterView />
        </main>
      )}

      {/* Leaderboard tab */}
      {activeTab === "leaderboard" && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LeaderboardView />
        </main>
      )}
    </div>
  );
}
