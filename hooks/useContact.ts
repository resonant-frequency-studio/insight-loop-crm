"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Contact } from "@/types/firestore";

/**
 * Hook to fetch a single contact for a user
 * Uses contacts list cache as placeholder data to avoid loading skeleton
 */
export function useContact(userId: string, contactId: string, initialData?: Contact) {
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
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!userId && !!contactId,
    initialData, // Only for true server-side initial data (not needed with HydrationBoundary)
    // Use contacts list cache as placeholder data to avoid loading state
    // This is a valid optimization: show contact from list while fetching full details
    placeholderData: () => {
      const contacts = queryClient.getQueryData<Contact[]>(["contacts", userId]);
      if (contacts) {
        return contacts.find((c) => c.contactId === contactId) || undefined;
      }
      return undefined;
    },
    refetchOnWindowFocus: false,
  });
}

