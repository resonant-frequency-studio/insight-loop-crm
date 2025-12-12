"use client";

import ThemedSuspense from "@/components/ThemedSuspense";
import StatCard from "./StatCard";
import { useDashboardStats, DashboardStats } from "@/hooks/useDashboardStats";

function DashboardStatsContent({ userId, initialStats }: { userId: string; initialStats?: DashboardStats }) {
  const { data: stats, isLoading } = useDashboardStats(userId, initialStats);
  
  // Show loading skeleton only if actually loading, not if data is temporarily undefined
  // React Query with prefetched data should have data available immediately on hydration
  if (isLoading && !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-[#EEEEEC] rounded-xl shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-4" />
            <div className="h-8 bg-gray-200 rounded w-16 mb-1" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
        ))}
      </div>
    );
  }
  
  // If no stats but not loading, show empty state or default values
  if (!stats) {
    // This shouldn't happen in production with prefetched data, but handle gracefully
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#EEEEEC] rounded-xl shadow p-6">
          <p className="text-gray-500">Loading stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard
        userId={userId}
        title="Total Contacts"
        description="Active contacts in your CRM"
        iconBgColor="bg-blue-100"
        icon={
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        }
        getValue={(stats) => stats?.totalContacts ?? 0}
      />
      <StatCard
        userId={userId}
        title="Active Threads"
        description="Contacts with email threads"
        iconBgColor="bg-green-100"
        icon={
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        }
        getValue={(stats) => stats?.contactsWithThreads ?? 0}
      />
      <StatCard
        userId={userId}
        title="Avg Engagement"
        description="Average engagement score"
        iconBgColor="bg-purple-100"
        icon={
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        }
        getValue={(stats) => stats?.averageEngagementScore ?? 0}
      />
    </div>
  );
}

export default function DashboardStatsCards({ userId, initialStats }: { userId: string; initialStats?: DashboardStats }) {
  // If we have initialStats, render directly without Suspense to avoid loading state
  if (initialStats) {
    return <DashboardStatsContent userId={userId} initialStats={initialStats} />;
  }

  return (
    <ThemedSuspense
      fallback={
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card-highlight-light rounded-xl shadow p-6 animate-pulse">
              <div className="h-4 bg-theme-light rounded w-24 mb-4" />
              <div className="h-8 bg-theme-light rounded w-16 mb-1" />
              <div className="h-4 bg-theme-light rounded w-32" />
            </div>
          ))}
        </div>
      }
    >
      <DashboardStatsContent userId={userId} />
    </ThemedSuspense>
  );
}

