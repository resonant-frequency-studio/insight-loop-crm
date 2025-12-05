"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface EngagementChartProps {
  data: {
    high: number;
    medium: number;
    low: number;
    none: number;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderTooltip = (props: any) => {
  const { active, payload } = props;
  if (active && payload && payload.length) {
    const data = payload[0];
    if (!data) return null;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900">{data.payload?.name || "Unknown"}</p>
        <p className="text-sm text-gray-600">{data.value || 0} contacts</p>
      </div>
    );
  }
  return null;
};

export default function EngagementChart({ data }: EngagementChartProps) {
  const chartData = [
    { name: "High (70+)", value: data.high, color: "#10b981" },
    { name: "Medium (40-69)", value: data.medium, color: "#f59e0b" },
    { name: "Low (1-39)", value: data.low, color: "#ef4444" },
    { name: "None (0)", value: data.none, color: "#9ca3af" },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 12 }}
          angle={-15}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip content={renderTooltip} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
