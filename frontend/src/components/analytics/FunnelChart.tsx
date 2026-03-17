import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface FunnelData {
  received: number;
  viewed: number;
  accepted: number;
  retained: number;
}

export default function FunnelChart({ data }: { data: FunnelData }) {
  const chartData = [
    { name: "Received", value: data.received, color: "#E5E5DC" },
    { name: "Viewed", value: data.viewed, color: "#FCCC6D" },
    { name: "Accepted", value: data.accepted, color: "#FCAA2D" },
    { name: "Retained", value: data.retained, color: "#D48A1A" },
  ];

  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-4">
        Lead Funnel
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical">
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
          <Tooltip />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
