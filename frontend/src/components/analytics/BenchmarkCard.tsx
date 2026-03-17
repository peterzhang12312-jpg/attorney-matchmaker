interface BenchmarkData {
  response_time_percentile: number;
  acceptance_rate_percentile: number;
  avg_response_hours: number;
  peer_avg_response_hours: number;
  acceptance_rate: number;
  peer_acceptance_rate: number;
}

function PercentileBadge({ value, label }: { value: number; label: string }) {
  const color = value >= 75 ? "text-green-700 bg-green-50 border-green-200"
    : value >= 50 ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-[rgba(25,25,24,0.45)] bg-[rgba(25,25,24,0.04)] border-[rgba(25,25,24,0.12)]";
  return (
    <div className={`border rounded-[8px] px-4 py-3 ${color}`}>
      <div className="text-2xl font-semibold font-mono">{value}th</div>
      <div className="font-mono text-[0.65rem] uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}

export default function BenchmarkCard({ data }: { data: BenchmarkData }) {
  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-4">
        Peer Benchmark
      </h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <PercentileBadge value={data.response_time_percentile} label="Response Time" />
        <PercentileBadge value={data.acceptance_rate_percentile} label="Acceptance Rate" />
      </div>
      <div className="space-y-2 text-sm text-[rgba(25,25,24,0.6)]">
        <div className="flex justify-between">
          <span>Avg response time</span>
          <span className="font-mono">{data.avg_response_hours}h <span className="text-[rgba(25,25,24,0.4)]">/ peer {data.peer_avg_response_hours}h</span></span>
        </div>
        <div className="flex justify-between">
          <span>Acceptance rate</span>
          <span className="font-mono">{(data.acceptance_rate * 100).toFixed(0)}% <span className="text-[rgba(25,25,24,0.4)]">/ peer {(data.peer_acceptance_rate * 100).toFixed(0)}%</span></span>
        </div>
      </div>
    </div>
  );
}
