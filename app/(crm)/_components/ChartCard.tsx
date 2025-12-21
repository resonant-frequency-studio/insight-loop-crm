"use client";

import Card from "@/components/Card";
import { useDashboardStatsRealtime } from "@/hooks/useDashboardStatsRealtime";
import { DashboardStats } from "@/hooks/useDashboardStats";
import { Contact } from "@/types/firestore";
import EmptyState from "@/components/dashboard/EmptyState";
import Skeleton from "@/components/Skeleton";

interface ChartCardProps {
  contacts: Contact[];
  title: string;
  children: (stats: DashboardStats) => React.ReactNode;
}

interface ChartContentProps {
  contacts: Contact[];
  children: (stats: DashboardStats) => React.ReactNode;
}

function ChartContent({ contacts, children }: ChartContentProps) {
  const { data: stats } = useDashboardStatsRealtime(contacts);
  if (!stats) return <Skeleton width="w-full" height="h-64" />;
  
  // Show empty state when no contacts
  if (stats.totalContacts === 0) {
    return (
      <EmptyState
        message="No data to display yet"
        description="Import contacts to see charts and analytics"
        showActions={true}
        wrapInCard={false}
        size="sm"
      />
    );
  }
  
  return <>{children(stats)}</>;
}

export default function ChartCard({ contacts, title, children }: ChartCardProps) {
  return (
    <Card padding="md">
      <h2 className="text-lg font-semibold text-theme-darkest mb-4">{title}</h2>
      <ChartContent contacts={contacts}>{children}</ChartContent>
    </Card>
  );
}

