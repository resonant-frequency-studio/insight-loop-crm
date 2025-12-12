"use client";

import ThemedSuspense from "@/components/ThemedSuspense";
import Card from "@/components/Card";
import { useDashboardStats } from "@/hooks/useDashboardStats";

interface StatCardProps {
  userId: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBgColor: string;
  getValue: (stats: NonNullable<ReturnType<typeof useDashboardStats>["data"]>) => number | string;
}

function StatValue({ userId, getValue }: { userId: string; getValue: StatCardProps["getValue"] }) {
  const { data: stats } = useDashboardStats(userId);
  if (!stats) return <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />;
  return <div className="text-3xl font-bold text-theme-darkest mb-1">{getValue(stats)}</div>;
}

export default function StatCard({ userId, title, description, icon, iconBgColor, getValue }: StatCardProps) {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</h3>
        <div className={`w-10 h-10 ${iconBgColor} rounded-sm flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <ThemedSuspense variant="simple">
        <StatValue userId={userId} getValue={getValue} />
      </ThemedSuspense>
      <p className="text-sm text-gray-500">{description}</p>
    </Card>
  );
}

