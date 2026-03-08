import type { HealthResponse } from "../types/api";
import type { Tab } from "../App";
import StatusPill from "./StatusPill";
import { Scale } from "lucide-react";

interface HeaderProps {
  health: HealthResponse | null;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { key: Tab; label: string }[] = [
  { key: "find", label: "Find Attorneys" },
  { key: "roster", label: "Browse Roster" },
  { key: "leaderboard", label: "Rankings" },
];

export default function Header({ health, activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="bg-[rgba(255,254,242,0.9)] backdrop-blur-md border-b border-[rgba(25,25,24,0.05)] sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <Scale className="h-6 w-6 text-[#FCAA2D]" strokeWidth={1.8} />
            <span className="text-lg font-semibold tracking-tight text-[#191918]">
              Attorney Matchmaker
            </span>
          </div>

          {/* Center: Tabs */}
          <nav className="hidden sm:flex items-center gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => onTabChange(t.key)}
                className={`px-4 py-2 font-mono text-[0.72rem] uppercase tracking-wide transition-colors ${
                  activeTab === t.key
                    ? "border-b-2 border-[#FCAA2D] text-[#191918]"
                    : "text-[rgba(25,25,24,0.45)] hover:text-[#191918]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Right: Status */}
          <StatusPill health={health} />
        </div>

        {/* Mobile tabs */}
        <div className="sm:hidden flex gap-1 pb-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              className={`flex-1 px-3 py-2 font-mono text-[0.68rem] uppercase tracking-wide transition-colors ${
                activeTab === t.key
                  ? "border-b-2 border-[#FCAA2D] text-[#191918]"
                  : "text-[rgba(25,25,24,0.45)] hover:text-[#191918]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
