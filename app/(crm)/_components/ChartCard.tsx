"use client";

import ThemedSuspense from "@/components/ThemedSuspense";
import Card from "@/components/Card";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import EmptyState from "@/components/dashboard/EmptyState";
import Skeleton from "@/components/Skeleton";

interface ChartCardProps {
  userId: string;
  title: string;
  children: (stats: NonNullable<ReturnType<typeof useDashboardStats>["data"]>) => React.ReactNode;
}

interface ChartContentProps {
  userId: string;
  children: (stats: NonNullable<ReturnType<typeof useDashboardStats>["data"]>) => React.ReactNode;
}

function ChartContent({ userId, children }: ChartContentProps) {
  const { data: stats } = useDashboardStats(userId);
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

export default function ChartCard({ userId, title, children }: ChartCardProps) {
  return (
    <Card padding="md">
      <h2 className="text-lg font-semibold text-theme-darkest mb-4">{title}</h2>
      <ThemedSuspense fallback={<div className="h-64 bg-theme-light rounded animate-pulse" />}>
        <ChartContent userId={userId}>{children}</ChartContent>
      </ThemedSuspense>
    </Card>
  );
}

