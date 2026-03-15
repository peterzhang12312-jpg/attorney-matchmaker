import type { CaseMeta, SimilarityAnalysis } from "../../types/api";

const OUTCOME_COLORS: Record<string, string> = {
  "Ongoing":       "bg-yellow-100 text-yellow-800",
  "Settled":       "bg-green-100 text-green-800",
  "Dismissed":     "bg-blue-100 text-blue-800",
  "Plaintiff Win": "bg-green-100 text-green-800",
  "Defendant Win": "bg-red-100 text-red-800",
  "Resolved":      "bg-gray-100 text-gray-700",
};

interface Props {
  caseMeta: CaseMeta;
  caseSummary?: string;
  similarity?: SimilarityAnalysis;
  queryType: string;
}

export default function CaseResultCard({ caseMeta, caseSummary, similarity, queryType }: Props) {
  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-1">
            Found via {queryType.replace("_", " ")}
          </p>
          <h2 className="text-xl font-bold text-[#191918]">{caseMeta.name}</h2>
        </div>
        {caseMeta.outcome_tag && (
          <span className={`font-mono text-[0.65rem] uppercase tracking-wide px-3 py-1 rounded-full whitespace-nowrap ${OUTCOME_COLORS[caseMeta.outcome_tag] ?? "bg-gray-100 text-gray-700"}`}>
            {caseMeta.outcome_tag}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {[
          ["Court", caseMeta.court],
          ["Filed", caseMeta.date_filed || "Unknown"],
          ["Judge", caseMeta.judge || "Unknown"],
          ["Docket", caseMeta.docket_number || "—"],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">{label}</p>
            <p className="text-sm text-[#191918] font-medium mt-0.5 truncate">{value}</p>
          </div>
        ))}
      </div>

      {caseMeta.cl_url && (
        <a href={caseMeta.cl_url} target="_blank" rel="noopener noreferrer"
          className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#FCAA2D] transition-colors">
          View on CourtListener
        </a>
      )}

      {caseSummary && (
        <div className="mt-4 pt-4 border-t border-[rgba(25,25,24,0.08)]">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-2">AI Case Summary</p>
          <p className="text-sm text-[rgba(25,25,24,0.7)] leading-relaxed whitespace-pre-line">{caseSummary}</p>
        </div>
      )}

      {similarity && (
        <div className="mt-4 pt-4 border-t border-[rgba(25,25,24,0.08)]">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">Similarity to your case</span>
            <span className={`font-mono text-sm font-bold ${similarity.score >= 70 ? "text-green-600" : similarity.score >= 40 ? "text-yellow-600" : "text-red-500"}`}>
              {similarity.score}%
            </span>
          </div>
          <p className="text-sm text-[rgba(25,25,24,0.7)] mb-2">{similarity.recommendation}</p>
          {similarity.matching_elements.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {similarity.matching_elements.map((el) => (
                <span key={el} className="bg-green-50 border border-green-200 text-green-700 font-mono text-[0.6rem] uppercase px-2 py-0.5 rounded">{el}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
