import { QueryClient } from "@tanstack/react-query";
import { cache } from "react";

/**
 * Get or create a QueryClient instance for SSR.
 * Uses React's cache() to ensure one QueryClient per request in Next.js App Router.
 */
export const getQueryClient = cache(() => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds - data is fresh for 30s, then eligible for background refetch
        gcTime: 5 * 60 * 1000, // 5 minutes - keep in memory for 5 min after last use
        refetchOnWindowFocus: true, // Refresh when user returns to tab
        refetchOnReconnect: true, // Refresh when network reconnects
        refetchOnMount: true, // Refetch if data is stale (e.g., after invalidation). Fresh data (within staleTime) won't refetch
        retry: 1, // Only retry once on failure
      },
    },
  });
});

