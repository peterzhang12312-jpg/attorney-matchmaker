import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface TrendPoint {
  week: string;
  practice_area: string;
  count: number;
}

export default function TrendsChart({ points }: { points: TrendPoint[] }) {
  const weeks = [...new Set(points.map(p => p.week))].sort();
  const areas = [...new Set(points.map(p => p.practice_area))];

  const chartData = weeks.map(week => {
    const row: Record<string, string | number> = { week };
    for (const area of areas) {
      const pt = points.find(p => p.week === week && p.practice_area === area);
      row[area] = pt?.count ?? 0;
    }
    return row;
  });

  const COLORS = ["#FCAA2D", "#D48A1A", "#191918", "#8B7355", "#FCCC6D"];

  if (points.length === 0) {
    return (
      <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-4">
          Demand Trends (12 weeks)
        </h3>
        <p className="text-sm text-[rgba(25,25,24,0.45)]">No lead data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-4">
        Demand Trends (12 weeks)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={w => w.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          {areas.map((area, i) => (
            <Line
              key={area}
              type="monotone"
              dataKey={area}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
