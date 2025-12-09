"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionItem } from "@/types/firestore";

/**
 * Hook to fetch action items
 * @param userId - The user ID
 * @param contactId - Optional contact ID. If provided, fetches action items for that contact only
 * @param initialData - Optional initial data from server prefetch
 */
export function useActionItems(
  userId: string,
  contactId?: string,
  initialData?: ActionItem[] | Array<ActionItem & { contactId: string }>
) {
  const queryClient = useQueryClient();

  const queryKey = contactId
    ? ["action-items", userId, contactId]
    : ["action-items", userId];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (contactId) {
        const response = await fetch(`/api/action-items?contactId=${encodeURIComponent(contactId)}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch action items");
        }
        const data = await response.json();
        return data.actionItems as ActionItem[];
      } else {
        const response = await fetch("/api/action-items/all");
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch action items");
        }
        const data = await response.json();
        return data.actionItems as Array<ActionItem & { contactId: string }>;
      }
    },
    enabled: !!userId,
    initialData, // Only for true server-side initial data (not needed with HydrationBoundary)
    // If fetching single contact's action items, use all action items cache as placeholder
    // This is a valid optimization: show filtered items while fetching
    placeholderData: () => {
      if (contactId) {
        const allActionItems = queryClient.getQueryData<Array<ActionItem & { contactId: string }>>([
          "action-items",
          userId,
        ]);
        if (allActionItems) {
          return allActionItems.filter((item) => item.contactId === contactId);
        }
      }
      return undefined;
    },
    // Uses global defaults: staleTime: 0, refetchOnWindowFocus: true, refetchOnMount: true
  });
}

