"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SentimentChartProps {
  data: Record<string, number>;
}


const SENTIMENT_COLORS: Record<string, string> = {
  Positive: "#10b981", // green
  Neutral: "#6b7280", // gray
  Negative: "#ef4444", // red
  "Very Positive": "#059669", // darker green
  "Very Negative": "#dc2626", // darker red
};

const DEFAULT_COLOR = "#3b82f6"; // blue

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderTooltip = (props: any) => {
  const { active, payload } = props;
  if (active && payload && payload.length) {
    const data = payload[0];
    const total = payload.reduce((sum, item) => sum + (item.value || 0), 0);
    const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : "0";
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900">{data.name}</p>
        <p className="text-sm text-gray-600">
          {data.value} contacts ({percentage}%)
        </p>
      </div>
    );
  }
  return null;
};

export default function SentimentChart({ data }: SentimentChartProps) {
  const chartData = Object.entries(data)
    .map(([name, value]) => ({ name: name.trim(), value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>No sentiment data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={90}
          innerRadius={30}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={SENTIMENT_COLORS[entry.name] || DEFAULT_COLOR}
            />
          ))}
        </Pie>
        <Tooltip content={renderTooltip} />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => {
            const item = chartData.find((d) => d.name === value);
            if (!item) return value;
            const total = chartData.reduce((sum, d) => sum + d.value, 0);
            const percentage = ((item.value / total) * 100).toFixed(0);
            return `${value} (${percentage}%)`;
          }}
          wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
