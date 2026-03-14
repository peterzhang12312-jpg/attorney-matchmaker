import { useState } from "react";
import { MapPin, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import type { VenueRecommendation } from "../types/api";

interface VenueRecommendationCardProps {
  recommendation: VenueRecommendation;
}

export default function VenueRecommendationCard({
  recommendation,
}: VenueRecommendationCardProps) {
  const [altOpen, setAltOpen] = useState(false);

  return (
    <div className="rounded-xl bg-white border border-[rgba(25,25,24,0.12)] overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 pt-5 pb-3 border-b border-[rgba(25,25,24,0.06)]">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-[#FCAA2D]" />
          <span className="font-mono text-[0.68rem] uppercase tracking-widest text-[#FCAA2D]">
            Recommended Venue
          </span>
        </div>
      </div>

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Primary recommendation */}
        <div>
          <p className="text-lg font-bold text-gray-900 break-words">
            {recommendation.recommended_court_label}
          </p>
          <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
            {recommendation.reasoning}
          </p>
        </div>

        {/* John Doe banner */}
        {recommendation.john_doe_protocol && recommendation.john_doe_recommendation && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
                Unknown Defendant — John Doe Protocol
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                {recommendation.john_doe_recommendation}
              </p>
            </div>
          </div>
        )}

        {/* Alternatives accordion */}
        {recommendation.alternatives.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setAltOpen(!altOpen)}
              className="flex items-center gap-1.5 min-h-[44px] text-xs font-medium text-[#FCAA2D] hover:text-amber-600 transition-colors"
            >
              {altOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {altOpen ? "Hide" : "Show"} alternative venues
            </button>

            {altOpen && (
              <div className="mt-3 space-y-2">
                {recommendation.alternatives.map((alt) => (
                  <div
                    key={alt.court}
                    className="rounded-lg bg-[rgba(25,25,24,0.02)] border border-[rgba(25,25,24,0.08)] px-4 py-3"
                  >
                    <p className="text-xs font-semibold text-gray-700">{alt.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
                      {alt.rationale}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Based on automated fact analysis only. Venue selection involves
          strategic and fact-specific considerations. Consult qualified counsel
          before filing.
        </p>
      </div>
    </div>
  );
}
