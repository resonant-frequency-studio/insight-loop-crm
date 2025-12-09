"use client";

import { useQuery } from "@tanstack/react-query";

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
 * Hook to fetch dashboard statistics for a user
 * React Query automatically handles prefetched data from HydrationBoundary
 */
export function useDashboardStats(userId: string, initialData?: DashboardStats) {
  return useQuery({
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
}
