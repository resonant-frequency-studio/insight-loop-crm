"use client";

import { Suspense } from "react";
import Card from "@/components/Card";
import { useDashboardStats } from "@/hooks/useDashboardStats";

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
  if (!stats) return <div className="h-64 bg-gray-200 rounded animate-pulse" />;
  return <>{children(stats)}</>;
}

export default function ChartCard({ userId, title, children }: ChartCardProps) {
  return (
    <Card padding="md">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      <Suspense fallback={<div className="h-64 bg-gray-200 rounded animate-pulse" />}>
        <ChartContent userId={userId}>{children}</ChartContent>
      </Suspense>
    </Card>
  );
}

