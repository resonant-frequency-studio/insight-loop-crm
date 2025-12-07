"use client";

import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SentimentChartProps {
  data: Record<string, number>;
}


const SENTIMENT_COLORS: Record<string, string> = {
  Positive: "#14b8a6", // sophisticated teal
  Neutral: "#64748b", // elegant slate
  Negative: "#ec4899", // muted rose
  "Very Positive": "#0d9488", // deeper teal
  "Very Negative": "#db2777", // deeper rose
};

const DEFAULT_COLOR = "#6366f1"; // elegant indigo

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderTooltip = (props: any) => {
  const { active, payload } = props;
  if (active && payload && payload.length) {
    const data = payload[0];
    const total = payload.reduce((sum: number, item: { value?: number }) => sum + (item.value || 0), 0);
    const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : "0";
    return (
      <div className="bg-white p-2 lg:p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900 text-xs lg:text-sm">{data.name}</p>
        <p className="text-xs text-gray-600">
          {data.value} contacts ({percentage}%)
        </p>
      </div>
    );
  }
  return null;
};

export default function SentimentChart({ data }: SentimentChartProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
    <div className="w-full">
      <ResponsiveContainer width="100%" height={isMobile ? 380 : 450}>
        <PieChart margin={isMobile ? { top: 0, right: 5, bottom: 0, left: 5 } : { top: 5, right: 5, bottom: 5, left: 5 }}>
          <Pie
            data={chartData}
            cx="50%"
            cy={isMobile ? "45%" : "48%"}
            labelLine={false}
            outerRadius={isMobile ? "70%" : "82%"}
            innerRadius={isMobile ? "25%" : "45%"}
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
            height={isMobile ? 50 : 50}
            formatter={(value) => {
              const item = chartData.find((d) => d.name === value);
              if (!item) return value;
              const total = chartData.reduce((sum, d) => sum + d.value, 0);
              const percentage = ((item.value / total) * 100).toFixed(0);
              return `${value} (${percentage}%)`;
            }}
            wrapperStyle={{ 
              fontSize: isMobile ? "11px" : "13px", 
              paddingTop: isMobile ? "5px" : "10px",
              lineHeight: "1.4"
            }}
            iconSize={isMobile ? 10 : 12}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
