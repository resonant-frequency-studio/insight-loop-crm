"use client";

import { Suspense } from "react";
import ChartCard from "./ChartCard";
import SegmentChart from "@/components/charts/SegmentChart";
import LeadSourceChart from "@/components/charts/LeadSourceChart";
import EngagementChart from "@/components/charts/EngagementChart";
import TopTagsChart from "@/components/charts/TopTagsChart";
import SentimentChart from "@/components/charts/SentimentChart";
import { useDashboardStats } from "@/hooks/useDashboardStats";

function DashboardChartsContent({ userId }: { userId: string }) {
  const { data: stats } = useDashboardStats(userId);
  
  if (!stats) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-40 mb-4" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

      <div className="lg:col-span-2">
        <ChartCard userId={userId} title="Sentiment Distribution">
          {(stats) => <SentimentChart data={stats.sentimentDistribution} />}
        </ChartCard>
      </div>
    </div>
  );
}

export default function DashboardCharts({ userId }: { userId: string }) {
  return (
    <Suspense
      fallback={
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-40 mb-4" />
              <div className="h-64 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      }
    >
      <DashboardChartsContent userId={userId} />
    </Suspense>
  );
}

