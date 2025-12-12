"use client";

import ThemedSuspense from "@/components/ThemedSuspense";
import ChartCard from "./ChartCard";
import SegmentChart from "./charts/SegmentChart";
import LeadSourceChart from "./charts/LeadSourceChart";
import EngagementChart from "./charts/EngagementChart";
import TopTagsChart from "./charts/TopTagsChart";
import SentimentChart from "./charts/SentimentChart";
import { useDashboardStats, DashboardStats } from "@/hooks/useDashboardStats";

function DashboardChartsContent({ userId, initialStats }: { userId: string; initialStats?: DashboardStats }) {
  const { data: stats, isLoading } = useDashboardStats(userId, initialStats);
  
  // Show loading skeleton only if actually loading, not if data is temporarily undefined
  // React Query with prefetched data should have data available immediately on hydration
  if (isLoading && !stats) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#EEEEEC] rounded-xl shadow p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-40 mb-4" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }
  
  // If no stats but not loading, show empty state
  if (!stats) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[#EEEEEC] rounded-xl shadow p-6">
          <p className="text-gray-500">Loading charts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <ChartCard userId={userId} title="Segment Distribution">
        {(stats) => <SegmentChart data={stats.segmentDistribution} />}
      </ChartCard>

      <ChartCard userId={userId} title="Lead Source Distribution">
        {(stats) => <LeadSourceChart data={stats.leadSourceDistribution} />}
      </ChartCard>

      <ChartCard userId={userId} title="Engagement Levels">
        {(stats) => <EngagementChart data={stats.engagementLevels} />}
      </ChartCard>

      <ChartCard userId={userId} title="Top Tags">
        {(stats) => <TopTagsChart data={stats.tagDistribution} />}
      </ChartCard>

      <div className="xl:col-span-2">
        <ChartCard userId={userId} title="Sentiment Distribution">
          {(stats) => <SentimentChart data={stats.sentimentDistribution} />}
        </ChartCard>
      </div>
    </div>
  );
}

export default function DashboardCharts({ userId, initialStats }: { userId: string; initialStats?: DashboardStats }) {
  // If we have initialStats, render directly without Suspense to avoid loading state
  if (initialStats) {
    return <DashboardChartsContent userId={userId} initialStats={initialStats} />;
  }

  return (
    <ThemedSuspense
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
    >
      <DashboardChartsContent userId={userId} />
    </ThemedSuspense>
  );
}

