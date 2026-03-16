import { useEffect, useState } from "react";

interface PlatformStats {
  cases_analyzed: number;
  attorneys_registered: number;
  practice_areas: number;
  jurisdictions: number;
}

function useCountUp(target: number, duration = 1200): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const steps = 40;
    const increment = target / steps;
    const interval = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + increment, target);
      setCount(Math.floor(current));
      if (current >= target) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

function StatItem({ value, label }: { value: number; label: string }) {
  const animated = useCountUp(value);
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-4">
      <span className="font-mono text-2xl sm:text-3xl font-bold text-[#191918]">
        {animated > 0 ? animated.toLocaleString() : "\u2014"}
      </span>
      <span className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">
        {label}
      </span>
    </div>
  );
}

export default function StatsBand() {
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <section className="bg-white border-y border-[rgba(25,25,24,0.12)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2">
        <div className="flex flex-wrap justify-center divide-x divide-[rgba(25,25,24,0.08)]">
          <StatItem value={stats?.cases_analyzed ?? 0} label="Cases Analyzed" />
          <StatItem value={stats?.attorneys_registered ?? 0} label="Attorneys Registered" />
          <StatItem value={stats?.practice_areas ?? 16} label="Practice Areas" />
          <StatItem value={stats?.jurisdictions ?? 9} label="Court Jurisdictions" />
        </div>
      </div>
    </section>
  );
}
