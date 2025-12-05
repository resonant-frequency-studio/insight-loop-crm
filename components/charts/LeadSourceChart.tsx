"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface LeadSourceChartProps {
  data: Record<string, number>;
}


const COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
];

// Group small slices into "Other"
function groupSmallSlices(data: Array<{ name: string; value: number }>, minPercentage = 3) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const threshold = (total * minPercentage) / 100;
  
  const mainSlices: Array<{ name: string; value: number }> = [];
  const otherSlices: Array<{ name: string; value: number }> = [];
  
  data.forEach((item) => {
    if (item.value >= threshold) {
      mainSlices.push(item);
    } else {
      otherSlices.push(item);
    }
  });
  
  if (otherSlices.length > 0) {
    const otherTotal = otherSlices.reduce((sum, item) => sum + item.value, 0);
    mainSlices.push({ name: "Other", value: otherTotal });
  }
  
  return mainSlices;
}

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

export default function LeadSourceChart({ data }: LeadSourceChartProps) {
  const allData = Object.entries(data)
    .map(([name, value]) => ({ name: name.trim() || "Unknown", value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  
  const chartData = groupSmallSlices(allData, 3).slice(0, 7);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>No lead source data available</p>
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
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
