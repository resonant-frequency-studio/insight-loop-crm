"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getUIMode } from "@/lib/ui-mode";

/**
 * Pipeline counts by segment
 */
export interface PipelineCounts {
  [segment: string]: number;
}

/**
 * Hook to fetch pipeline counts (segment distribution)
 */
export function usePipelineCounts(userId: string) {
  const query = useQuery({
    queryKey: ["pipeline-counts", userId],
    queryFn: async () => {
      const response = await fetch("/api/pipeline-counts");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch pipeline counts");
      }
      const data = await response.json();
      return data.counts as PipelineCounts;
    },
    enabled: !!userId,
    staleTime: 1000 * 60, // 1 minute - segments don't change frequently
  });

  const uiMode = getUIMode();

  // Override query result based on UI mode
  return useMemo(() => {
    if (uiMode === "suspense") {
      return { ...query, data: undefined, isLoading: true };
    }
    if (uiMode === "empty") {
      return { ...query, data: {}, isLoading: false };
    }
    return query;
  }, [query, uiMode]);
}

