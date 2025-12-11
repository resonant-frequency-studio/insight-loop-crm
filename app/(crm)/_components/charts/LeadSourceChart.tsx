"use client";

import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface LeadSourceChartProps {
  data: Record<string, number>;
}


const COLORS = [
  "#6366f1", // elegant indigo
  "#14b8a6", // sophisticated teal
  "#8b5cf6", // refined purple
  "#ec4899", // muted rose
  "#f59e0b", // warm amber
  "#06b6d4", // serene cyan
  "#10b981", // fresh emerald
  "#64748b", // sophisticated slate
  "#f97316", // vibrant coral
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = payload.reduce((sum: number, item: any) => sum + (item.value || 0), 0);
    const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : "0";
    return (
      <div className="bg-[#EEEEEC] p-2 xl:p-3 border border-gray-200 rounded-md shadow-lg">
        <p className="font-semibold text-theme-darkest text-xs xl:text-sm">{data.name}</p>
        <p className="text-xs text-theme-dark">
          {data.value} contacts ({percentage}%)
        </p>
      </div>
    );
  }
  return null;
};

export default function LeadSourceChart({ data }: LeadSourceChartProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1280);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
