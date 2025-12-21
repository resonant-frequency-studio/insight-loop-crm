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
    <div className="space-y-3">
      {/* Total Contacts */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-theme-dark">Total Contacts</p>
            <p className="text-2xl font-bold text-theme-darkest">{stats.totalContacts.toLocaleString()}</p>
          </div>
        </div>
      </Card>

      {/* Active Threads */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-theme-dark">Active Threads</p>
            <p className="text-2xl font-bold text-theme-darkest">{stats.contactsWithThreads.toLocaleString()}</p>
          </div>
        </div>
      </Card>

      {/* Avg Engagement */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-theme-dark">Avg Engagement</p>
            <p className="text-2xl font-bold text-theme-darkest">{stats.averageEngagementScore.toFixed(1)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

