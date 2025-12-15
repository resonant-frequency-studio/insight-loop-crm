"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getUIMode } from "@/lib/ui-mode";

/**
 * Dashboard statistics type
 */
export interface DashboardStats {
  totalContacts: number;
  contactsWithEmail: number;
  contactsWithThreads: number;
  averageEngagementScore: number;
  segmentDistribution: Record<string, number>;
  leadSourceDistribution: Record<string, number>;
  tagDistribution: Record<string, number>;
  sentimentDistribution: Record<string, number>;
  engagementLevels: {
    high: number;
    medium: number;
    low: number;
    none: number;
  };
  upcomingTouchpoints: number;
}

/**
 * Empty dashboard stats object for UI mode testing
 */
const emptyDashboardStats: DashboardStats = {
  totalContacts: 0,
  contactsWithEmail: 0,
  contactsWithThreads: 0,
  averageEngagementScore: 0,
  segmentDistribution: {},
  leadSourceDistribution: {},
  tagDistribution: {},
  sentimentDistribution: {},
  engagementLevels: { high: 0, medium: 0, low: 0, none: 0 },
  upcomingTouchpoints: 0,
};

/**
 * Hook to fetch dashboard statistics for a user
 * React Query automatically handles prefetched data from HydrationBoundary
 */
export function useDashboardStats(userId: string, initialData?: DashboardStats) {
  const query = useQuery({
    queryKey: ["dashboard-stats", userId],
    queryFn: async () => {
      const response = await fetch("/api/dashboard-stats");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch dashboard stats");
      }
      const data = await response.json();
      return data.stats as DashboardStats;
    },
    enabled: !!userId,
    initialData, // Only for true server-side initial data (not needed with HydrationBoundary)
    // Uses global defaults: staleTime: 0, refetchOnWindowFocus: true, refetchOnMount: true
  });

  const uiMode = getUIMode();

  // Override query result based on UI mode
  return useMemo(() => {
    if (uiMode === "suspense") {
      return { ...query, data: undefined, isLoading: true };
    }
    if (uiMode === "empty") {
      return { ...query, data: emptyDashboardStats, isLoading: false };
    }
    return query;
  }, [query, uiMode]);
}
