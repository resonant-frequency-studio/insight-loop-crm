"use client";

import { useState, useEffect } from "react";
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
      <div className="bg-[#EEEEEC] p-2 xl:p-3 border border-gray-200 rounded-sm shadow-lg">
        <p className="font-semibold text-theme-darkest text-xs xl:text-sm">{data.payload?.name || "Unknown"}</p>
        <p className="text-xs text-theme-dark">{data.value || 0} contacts</p>
      </div>
    );
  }
  return null;
};

export default function EngagementChart({ data }: EngagementChartProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1280);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const chartData = [
    { name: "High (70+)", value: data.high, color: "#14b8a6" }, // sophisticated teal
    { name: "Medium (40-69)", value: data.medium, color: "#f59e0b" }, // warm amber
    { name: "Low (1-39)", value: data.low, color: "#ec4899" }, // muted rose
    { name: "None (0)", value: data.none, color: "#94a3b8" }, // elegant slate
  ];

  return (
    <div className="w-full -mb-2 xl:mb-0">
      <ResponsiveContainer width="100%" height={isMobile ? 320 : 450}>
        <BarChart 
          data={chartData} 
          margin={{ 
            top: isMobile ? 5 : 5, 
            right: isMobile ? 5 : 5, 
            left: isMobile ? 0 : 5, 
            bottom: isMobile ? 5 : 5 
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: isMobile ? 11 : 13 }}
            angle={isMobile ? -18 : -15}
            textAnchor="end"
            height={isMobile ? 28 : 45}
          />
          <YAxis 
            tick={{ fontSize: isMobile ? 11 : 13 }}
            width={isMobile ? 35 : undefined}
          />
          <Tooltip content={renderTooltip} />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
