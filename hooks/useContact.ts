"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Contact } from "@/types/firestore";

/**
 * Hook to fetch a single contact for a user
 * Uses contacts list cache as placeholder data to avoid loading skeleton
 * 
 * ⚠️ IMPORTANT: Does NOT use initialData to avoid snap-back on optimistic updates.
 * When both initialData and placeholderData are defined, React Query uses initialData
 * on refetch fallbacks, which causes UI to snap back to stale values.
 */
export function useContact(userId: string, contactId: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["contact", userId, contactId],
    queryFn: async () => {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactId)}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch contact");
      }
      const data = await response.json();
      return data.contact as Contact;
    },
    staleTime: 0, // Contact detail data changes frequently - always refetch
    enabled: !!userId && !!contactId,
    // ⭐ ONLY placeholderData — NO initialData
    // This ensures optimistic updates persist during refetches
    placeholderData: () => {
      // First check if we have the individual contact query data (includes optimistic updates)
      const detail = queryClient.getQueryData<Contact>(["contact", userId, contactId]);
      if (detail) return detail;

      // Otherwise fall back to contacts list
      const list = queryClient.getQueryData<Contact[]>(["contacts", userId]);
      return list?.find((c) => c.contactId === contactId);
    },
    // Uses global defaults: refetchOnWindowFocus: true, refetchOnMount: true
    // Optional: uncomment for near real-time updates on contact detail page
    // refetchInterval: 30_000, // Poll every 30s for "live-ish" UI
  });
}

