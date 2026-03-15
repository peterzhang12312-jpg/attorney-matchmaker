import { useState } from "react";

const EXAMPLES = [
  "1:23-cv-04521",
  "Smith v. Jones",
  "real estate fraud Queens landlord 2024",
];

interface Props {
  onSearch: (query: string) => void;
  loading: boolean;
}

export default function CaseSearchBox({ onSearch, loading }: Props) {
  const [query, setQuery] = useState("");

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && query.trim() && onSearch(query.trim())}
          placeholder="Enter docket number, case name, or describe a similar case..."
          className="flex-1 border border-[rgba(25,25,24,0.12)] rounded-md px-4 py-3 text-sm text-[#191918] bg-white placeholder-[rgba(25,25,24,0.35)] focus:outline-none focus:border-[#FCAA2D]"
        />
        <button
          onClick={() => query.trim() && onSearch(query.trim())}
          disabled={loading || !query.trim()}
          className="rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide px-6 min-h-[44px] disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <span className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.4)]">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => { setQuery(ex); onSearch(ex); }}
            className="font-mono text-[0.65rem] bg-white border border-[rgba(25,25,24,0.12)] rounded px-2 py-1 text-[rgba(25,25,24,0.55)] hover:border-[#FCAA2D] hover:text-[#191918] transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
