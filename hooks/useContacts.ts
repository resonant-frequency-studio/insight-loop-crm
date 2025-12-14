"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Contact } from "@/types/firestore";
import { getUIMode } from "@/lib/ui-mode";

/**
 * Hook to fetch all contacts for a user
 */
export function useContacts(userId: string, initialData?: Contact[]) {
  const query = useQuery({
    queryKey: ["contacts", userId],
    queryFn: async () => {
      // Force no-store to ensure fresh data from API (which also uses no-store)
      const response = await fetch("/api/contacts", { cache: "no-store" });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch contacts");
      }
      const data = await response.json();
      return data.contacts as Contact[];
    },
    enabled: !!userId,
    staleTime: 0, // Contacts list changes frequently - always refetch
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // ONLY use initialData for SSR - do NOT use placeholderData
    // placeholderData was preventing React Query from recognizing fresh data
    initialData, // Only if SSR provides initial list
  });

  const uiMode = getUIMode();

  // Override query result based on UI mode
  return useMemo(() => {
    if (uiMode === "suspense") {
      return { ...query, data: undefined, isLoading: true };
    }
    if (uiMode === "empty") {
      return { ...query, data: [], isLoading: false };
    }
    return query;
  }, [query, uiMode]);
}

