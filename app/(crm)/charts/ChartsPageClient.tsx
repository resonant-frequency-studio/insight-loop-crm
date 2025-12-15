"use client";

import { useAuth } from "@/hooks/useAuth";
import DashboardCharts from "../_components/DashboardCharts";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import EmptyState from "@/components/dashboard/EmptyState";
import ThemedSuspense from "@/components/ThemedSuspense";

export default function ChartsPageClient({ userId }: { userId: string }) {
  const { loading } = useAuth();
  const { data: initialStats, isLoading: statsLoading } = useDashboardStats(userId);

  if (loading && !userId) {
    return null;
  }
  
  // Show loading state if stats are loading (suspense mode)
  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Charts & Analytics</h1>
          <p className="text-theme-dark text-lg">Visual insights into your contact data and engagement metrics</p>
        </div>
        <ThemedSuspense
          isLoading={true}
          fallback={
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card-highlight-light rounded-xl shadow p-6 animate-pulse">
                  <div className="h-6 bg-theme-light rounded w-40 mb-4" />
                  <div className="h-64 bg-theme-light rounded" />
                </div>
              ))}
            </div>
          }
        />
      </div>
    );
  }
  
  // Show empty state if no contacts
  if (initialStats?.totalContacts === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Charts & Analytics</h1>
          <p className="text-theme-dark text-lg">
            Visual insights into your contact data and engagement metrics
          </p>
        </div>
        <EmptyState wrapInCard={true} size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Charts & Analytics</h1>
        <p className="text-theme-dark text-lg">
          Visual insights into your contact data and engagement metrics
        </p>
      </div>

      {/* Charts Section */}
      <DashboardCharts userId={userId} initialStats={initialStats} />
    </div>
  );
}

