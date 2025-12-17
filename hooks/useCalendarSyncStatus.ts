"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { SyncJob } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

interface UseCalendarSyncStatusReturn {
  lastSync: SyncJob | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch the latest calendar sync job status.
 * Uses server-side API to avoid Firestore composite index requirements.
 */
export function useCalendarSyncStatus(userId: string | null): UseCalendarSyncStatusReturn {
  const { data, isLoading, isError, error } = useQuery<SyncJob | null, Error>({
    queryKey: ["calendar-sync-status", userId],
    queryFn: async () => {
      if (!userId) return null;

      const response = await fetch(`/api/sync-status?service=calendar`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch calendar sync status");
      }

      const data = await response.json();
      return data.lastSync || null;
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  // Report errors separately (React Query v5 doesn't support onError)
  useEffect(() => {
    if (isError && error) {
      reportException(error, {
        context: "Fetching calendar sync status",
        tags: { component: "useCalendarSyncStatus", userId: userId || "unknown" },
      });
    }
  }, [isError, error, userId]);

  return {
    lastSync: data || null,
    loading: isLoading,
    error: isError ? error.message : null,
  };
}

