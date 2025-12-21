"use client";

import ChartCard from "./ChartCard";
import SegmentChart from "./charts/SegmentChart";
import LeadSourceChart from "./charts/LeadSourceChart";
import EngagementChart from "./charts/EngagementChart";
import TopTagsChart from "./charts/TopTagsChart";
import SentimentChart from "./charts/SentimentChart";
import { useDashboardStatsRealtime } from "@/hooks/useDashboardStatsRealtime";
import { Contact } from "@/types/firestore";
import Skeleton from "@/components/Skeleton";

function DashboardChartsContent({ contacts }: { contacts: Contact[] }) {
  const { data: stats, isLoading } = useDashboardStatsRealtime(contacts);
  
  // Show loading skeleton only on initial load
  if (isLoading && !stats) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card-highlight-light rounded-xl shadow p-6">
            <Skeleton height="h-6" width="w-40" className="mb-4" />
            <Skeleton height="h-64" width="w-full" />
          </div>
        ))}
      </div>
    );
  }
  
  // If no stats but not loading, show empty state
  if (!stats) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-card-highlight-light rounded-xl shadow p-6">
          <p className="text-theme-dark">Loading charts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <ChartCard contacts={contacts} title="Segment Distribution">
        {(stats) => <SegmentChart data={stats.segmentDistribution} />}
      </ChartCard>

      <ChartCard contacts={contacts} title="Lead Source Distribution">
        {(stats) => <LeadSourceChart data={stats.leadSourceDistribution} />}
      </ChartCard>

      <ChartCard contacts={contacts} title="Engagement Levels">
        {(stats) => <EngagementChart data={stats.engagementLevels} />}
      </ChartCard>

      <ChartCard contacts={contacts} title="Top Tags">
        {(stats) => <TopTagsChart data={stats.tagDistribution} />}
      </ChartCard>

      <div className="xl:col-span-2">
        <ChartCard contacts={contacts} title="Sentiment Distribution">
          {(stats) => <SentimentChart data={stats.sentimentDistribution} />}
        </ChartCard>
      </div>
    </div>
  );
}

export default function DashboardCharts({ contacts }: { contacts: Contact[] }) {
  return <DashboardChartsContent contacts={contacts} />;
}

