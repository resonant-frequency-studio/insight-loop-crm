"use client";

import Card from "@/components/Card";
import { useDashboardStatsRealtime } from "@/hooks/useDashboardStatsRealtime";
import { DashboardStats } from "@/hooks/useDashboardStats";
import { Contact } from "@/types/firestore";
import Skeleton from "@/components/Skeleton";

interface StatCardProps {
  contacts: Contact[];
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBgColor: string;
  getValue: (stats: DashboardStats) => number | string;
  showEmptyMessage?: boolean;
}

function StatValue({ contacts, getValue, showEmptyMessage }: { contacts: Contact[]; getValue: StatCardProps["getValue"]; showEmptyMessage?: boolean }) {
  const { data: stats } = useDashboardStatsRealtime(contacts);
  if (!stats) return <Skeleton width="w-16" height="h-8" />;
  
  const value = getValue(stats);
  const isZero = typeof value === "number" && value === 0;
  
  if (showEmptyMessage && isZero) {
    return (
      <div className="mb-1">
        <div className="text-3xl font-bold text-theme-darkest mb-1">0</div>
        <p className="text-xs text-gray-500">No contacts yet</p>
      </div>
    );
  }
  
  return <div className="text-3xl font-bold text-theme-darkest mb-1">{value}</div>;
}

export default function StatCard({ contacts, title, description, icon, iconBgColor, getValue, showEmptyMessage }: StatCardProps) {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</h3>
        <div className={`w-10 h-10 ${iconBgColor} rounded-sm flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <StatValue contacts={contacts} getValue={getValue} showEmptyMessage={showEmptyMessage} />
      <p className="text-sm text-gray-500">{description}</p>
    </Card>
  );
}

