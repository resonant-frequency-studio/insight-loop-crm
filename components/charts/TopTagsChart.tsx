"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TopTagsChartProps {
  data: Record<string, number>;
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderTooltip = (props: any) => {
  const { active, payload } = props;
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900">{data.payload?.name || "Unknown"}</p>
        <p className="text-sm text-gray-600">{data.value} contacts</p>
      </div>
    );
  }
  return null;
};

export default function TopTagsChart({ data }: TopTagsChartProps) {
  const chartData = Object.entries(data)
    .map(([name, value]) => ({ name: name.trim(), value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Top 10 tags

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>No tags data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 35)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis 
          dataKey="name" 
          type="category" 
          width={120}
          tick={{ fontSize: 12 }}
          interval={0}
        />
        <Tooltip content={renderTooltip} />
        <Bar dataKey="value" fill="#3b82f6" radius={[0, 8, 8, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
