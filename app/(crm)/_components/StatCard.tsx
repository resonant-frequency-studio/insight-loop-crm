"use client";

import ThemedSuspense from "@/components/ThemedSuspense";
import Card from "@/components/Card";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import Skeleton from "@/components/Skeleton";

interface StatCardProps {
  userId: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBgColor: string;
  getValue: (stats: NonNullable<ReturnType<typeof useDashboardStats>["data"]>) => number | string;
  showEmptyMessage?: boolean;
}

function StatValue({ userId, getValue, showEmptyMessage }: { userId: string; getValue: StatCardProps["getValue"]; showEmptyMessage?: boolean }) {
  const { data: stats } = useDashboardStats(userId);
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

export default function StatCard({ userId, title, description, icon, iconBgColor, getValue, showEmptyMessage }: StatCardProps) {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</h3>
        <div className={`w-10 h-10 ${iconBgColor} rounded-sm flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <ThemedSuspense variant="simple">
        <StatValue userId={userId} getValue={getValue} showEmptyMessage={showEmptyMessage} />
      </ThemedSuspense>
      <p className="text-sm text-gray-500">{description}</p>
    </Card>
  );
}

