"use client";

import { useDashboardStatsRealtime } from "@/hooks/useDashboardStatsRealtime";
import { Contact } from "@/types/firestore";
import Card from "@/components/Card";

interface RightColumnMetricsProps {
  userId: string;
  contacts: Contact[];
}

export default function RightColumnMetrics({ contacts }: RightColumnMetricsProps) {
  const { data: stats } = useDashboardStatsRealtime(contacts);

  if (!stats) {
    return (
      <div className="space-y-3">
        <Card className="p-4">
          <div className="h-16 bg-card-highlight-light animate-pulse rounded" />
        </Card>
        <Card className="p-4">
          <div className="h-16 bg-card-highlight-light animate-pulse rounded" />
        </Card>
        <Card className="p-4">
          <div className="h-16 bg-card-highlight-light animate-pulse rounded" />
        </Card>
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Total Contacts */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-theme-dark opacity-70">Total Contacts</p>
          <p className="text-sm font-medium text-theme-darkest opacity-70">{stats.totalContacts.toLocaleString()}</p>
        </div>

        {/* Active Threads */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-theme-dark opacity-70">Active Threads</p>
          <p className="text-sm font-medium text-theme-darkest opacity-70">{stats.contactsWithThreads.toLocaleString()}</p>
        </div>

        {/* Avg Engagement */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-theme-dark opacity-70">Avg Engagement</p>
          <p className="text-sm font-medium text-theme-darkest opacity-70">{stats.averageEngagementScore.toFixed(1)}</p>
        </div>
      </div>
      <p className="text-xs text-theme-dark italic mt-4 pt-4 border-t border-theme-lighter opacity-70">
        These are background signals—useful for context, not a to-do list.
      </p>
    </Card>
  );
}

