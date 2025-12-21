"use client";

import { useMemo } from "react";
import { Contact } from "@/types/firestore";
import { DashboardStats } from "@/hooks/useDashboardStats";
import { calculateDashboardStats } from "@/util/dashboard-stats-client";
import { getUIMode } from "@/lib/ui-mode";

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
 * Hook to calculate dashboard statistics from contacts array in real-time
 * Stats are recalculated automatically when contacts change
 * 
 * @param contacts - Array of contacts to calculate stats from
 * @returns Dashboard statistics (memoized)
 */
export function useDashboardStatsRealtime(contacts: Contact[]): {
  data: DashboardStats | undefined;
  isLoading: boolean;
  error: null;
} {
  const uiMode = getUIMode();

  // Memoize stats calculation to avoid unnecessary recalculations
  const stats = useMemo(() => {
    if (contacts.length === 0) {
      return emptyDashboardStats;
    }
    return calculateDashboardStats(contacts);
  }, [contacts]);

  // Override result based on UI mode (for testing)
  return useMemo(() => {
    if (uiMode === "suspense") {
      return { data: undefined, isLoading: true, error: null };
    }
    if (uiMode === "empty") {
      return { data: emptyDashboardStats, isLoading: false, error: null };
    }
    // For real-time, stats are always available (calculated from contacts)
    // Loading state is handled by the contacts hook
    return { data: stats, isLoading: false, error: null };
  }, [stats, uiMode]);
}

