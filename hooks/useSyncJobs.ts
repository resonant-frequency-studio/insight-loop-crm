"use client";

import { useQuery } from "@tanstack/react-query";
import { SyncJob } from "@/types/firestore";

/**
 * Hook to fetch the most recent sync job for a user
 * React Query automatically handles prefetched data from HydrationBoundary
 */
export function useSyncJobs(
  userId: string,
  includeHistory: boolean = false,
  initialData?: SyncJob[] | SyncJob | null
) {
  return useQuery({
    queryKey: ["sync-jobs", userId, includeHistory ? "history" : "last"],
    queryFn: async () => {
      const url = includeHistory
        ? "/api/sync-jobs?history=true"
        : "/api/sync-jobs";
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch sync jobs");
      }
      const data = await response.json();
      return includeHistory
        ? (data.syncHistory as SyncJob[])
        : (data.lastSync as SyncJob | null);
    },
    staleTime: 0, // Sync jobs change frequently - always refetch
    enabled: !!userId,
    initialData, // Only for true server-side initial data (not needed with HydrationBoundary)
    // Uses global defaults: refetchOnWindowFocus: true, refetchOnMount: true
  });
}

