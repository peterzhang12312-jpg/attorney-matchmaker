import { useState } from "react";
import { ChevronDown, ChevronUp, Clock, AlertTriangle, Brain } from "lucide-react";
import type { GeminiAnalysis } from "../types/api";

interface FactAnalysisPanelProps {
  analysis: GeminiAnalysis;
  durationMs: number;
  warnings: string[];
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "primary" | "secondary" | "urgency";
}) {
  const styles: Record<string, string> = {
    default: "bg-[rgba(25,25,24,0.05)] text-[rgba(25,25,24,0.6)] border-[rgba(25,25,24,0.1)]",
    primary: "bg-[rgba(252,170,45,0.1)] text-[#191918] border-[rgba(252,170,45,0.3)]",
    secondary: "bg-[rgba(25,25,24,0.04)] text-[rgba(25,25,24,0.5)] border-[rgba(25,25,24,0.08)]",
    urgency: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

export default function FactAnalysisPanel({
  analysis,
  durationMs,
  warnings,
}: FactAnalysisPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] overflow-hidden rounded-xl">
      {/* Panel header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Brain className="h-5 w-5 text-[#FCAA2D]" />
          <h2 className="text-sm font-semibold text-gray-900">
            Case Matcher Strategic Analysis
          </h2>
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <div className="px-5 pb-5 space-y-4 border-t border-[rgba(25,25,24,0.06)]">
          {/* Warnings banner */}
          {warnings.length > 0 && (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  {warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">
                      {w}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Badges row */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="primary">{analysis.primary_legal_area}</Badge>
            {analysis.secondary_areas.map((area) => (
              <Badge key={area} variant="secondary">
                {area}
              </Badge>
            ))}
            <Badge variant="default">{analysis.jurisdiction}</Badge>
            <Badge variant="urgency">{analysis.urgency_level}</Badge>
          </div>

          {/* Key issues */}
          {analysis.key_issues.length > 0 && (
            <div>
              <h3 className="font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-2">
                Key Issues Identified
              </h3>
              <ul className="space-y-1.5">
                {analysis.key_issues.map((issue, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#FCAA2D] shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fact summary */}
          {analysis.fact_summary && (
            <div>
              <h3 className="font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-2">
                Fact Summary
              </h3>
              <blockquote className="border-l-2 border-[rgba(252,170,45,0.4)] pl-4 text-sm text-[rgba(25,25,24,0.55)] italic leading-relaxed">
                {analysis.fact_summary}
              </blockquote>
            </div>
          )}

          {/* Pipeline duration */}
          <div className="flex items-center gap-1.5 pt-1">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-400">
              Completed in{" "}
              <span className="font-mono text-gray-500">
                {durationMs.toLocaleString()}ms
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
