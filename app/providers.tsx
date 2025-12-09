"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0, // Always considered stale - data is instantly usable but always eligible for refetch
            gcTime: 5 * 60 * 1000, // 5 minutes - keep in memory for 5 min after last use
            refetchOnWindowFocus: true, // Refresh when user returns to tab
            refetchOnReconnect: true, // Refresh when network reconnects
            refetchOnMount: true, // Refetch on mount if data is stale
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

