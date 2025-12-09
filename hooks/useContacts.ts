"use client";

import { useQuery } from "@tanstack/react-query";
import { Contact } from "@/types/firestore";

/**
 * Hook to fetch all contacts for a user
 * React Query automatically handles prefetched data from HydrationBoundary
 */
export function useContacts(userId: string, initialData?: Contact[]) {
  return useQuery({
    queryKey: ["contacts", userId],
    queryFn: async () => {
      const response = await fetch("/api/contacts");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch contacts");
      }
      const data = await response.json();
      return data.contacts as Contact[];
    },
    enabled: !!userId,
    initialData, // Only for true server-side initial data (not needed with HydrationBoundary)
    // Uses global defaults: staleTime: 0, refetchOnWindowFocus: true, refetchOnMount: true
  });
}

