"use client";

import { useState, useEffect } from "react";
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
      <div className="bg-white p-2 lg:p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900 text-xs lg:text-sm">{data.payload?.name || "Unknown"}</p>
        <p className="text-xs text-gray-600">{data.value} contacts</p>
      </div>
    );
  }
  return null;
};

export default function TopTagsChart({ data }: TopTagsChartProps) {
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
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Top 10 tags

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>No tags data available</p>
      </div>
    );
  }

  const baseHeight = isMobile ? 320 : 300;
  const rowHeight = isMobile ? 32 : 35;
  const chartHeight = Math.max(baseHeight, chartData.length * rowHeight);

  return (
    <div className="w-full">
      <ResponsiveContainer 
        width="100%" 
        height={chartHeight}
      >
        <BarChart 
          data={chartData} 
          layout="vertical" 
          margin={{ 
            left: isMobile ? 5 : 10, 
            right: isMobile ? 5 : 20, 
            top: 5, 
            bottom: 5 
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis 
            type="number" 
            tick={{ fontSize: isMobile ? 10 : 12 }}
          />
          <YAxis 
            dataKey="name" 
            type="category" 
            width={isMobile ? 80 : 120}
            tick={{ fontSize: isMobile ? 10 : 12 }}
            interval={0}
          />
          <Tooltip content={renderTooltip} />
          <Bar dataKey="value" fill="#6366f1" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
