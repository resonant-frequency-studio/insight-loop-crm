"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarEvent } from "@/types/firestore";

interface CalendarEventsResponse {
  events: CalendarEvent[];
  syncStats?: {
    synced: number;
    errors: string[];
  };
}

/**
 * Hook to fetch calendar events for a date range
 */
export function useCalendarEvents(
  userId: string,
  timeMin: Date,
  timeMax: Date,
  options?: { enabled?: boolean }
) {
  const query = useQuery({
    queryKey: ["calendar-events", userId, timeMin.toISOString(), timeMax.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
      });

      const url = `/api/calendar/events?${params.toString()}`;
      console.log('[useCalendarEvents] Fetching:', url);
      
      const response = await fetch(url, {
        credentials: 'include', // Include session cookie
      });
      
      console.log('[useCalendarEvents] Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[useCalendarEvents] Error response:', errorData);
        throw new Error(errorData.error || "Failed to fetch calendar events");
      }

      const data = await response.json() as CalendarEventsResponse;
      console.log('[useCalendarEvents] Success, events count:', data.events?.length || 0);
      if (data.syncStats) {
        console.log('[useCalendarEvents] Sync stats:', data.syncStats);
      }
      return data.events;
    },
    enabled: !!userId && (options?.enabled !== false),
    staleTime: 30 * 1000, // 30 seconds - matches query client default
  });

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

