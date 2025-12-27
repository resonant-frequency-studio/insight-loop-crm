import { useQuery } from "@tanstack/react-query";

interface CalendarSubscriptionStatus {
  hasActiveSubscription: boolean;
  expiresAt: string | null;
  channelCount: number;
}

/**
 * Hook to fetch calendar webhook subscription status
 */
export function useCalendarSubscriptionStatus(userId: string | null) {
  return useQuery<CalendarSubscriptionStatus>({
    queryKey: ["calendar-subscription-status", userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error("User ID is required");
      }

      const response = await fetch("/api/calendar/subscription-status");
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch subscription status");
      }

      const data = await response.json();
      return data as CalendarSubscriptionStatus;
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute to keep status updated
  });
}

