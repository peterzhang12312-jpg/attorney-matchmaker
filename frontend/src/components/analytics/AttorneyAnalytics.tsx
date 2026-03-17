import { useState, useEffect } from "react";
import FunnelChart from "./FunnelChart";
import BenchmarkCard from "./BenchmarkCard";
import TrendsChart from "./TrendsChart";

interface Props {
  token: string;
}

export default function AttorneyAnalytics({ token }: Props) {
  const [funnel, setFunnel] = useState<any>(null);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [fRes, bRes, tRes] = await Promise.all([
          fetch("/api/attorney/analytics/funnel", { headers }),
          fetch("/api/attorney/analytics/benchmark", { headers }),
          fetch("/api/attorney/analytics/trends", { headers }),
        ]);
        const [f, b, t] = await Promise.all([fRes.json(), bRes.json(), tRes.json()]);
        setFunnel(f.data);
        setBenchmark(b.data);
        setTrends(t.points);
      } catch (e) {
        setError("Failed to load analytics.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) return <p className="text-sm text-[rgba(25,25,24,0.45)] p-4">Loading analytics...</p>;
  if (error) return <p className="text-sm text-red-600 p-4">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {funnel && <FunnelChart data={funnel} />}
        {benchmark && <BenchmarkCard data={benchmark} />}
      </div>
      {trends && <TrendsChart points={trends} />}
    </div>
  );
}
