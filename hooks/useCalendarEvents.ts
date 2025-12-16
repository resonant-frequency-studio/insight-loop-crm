"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarEvent } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

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

/**
 * Mutation hook to link a calendar event to a contact
 */
export function useLinkEventToContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, contactId }: { eventId: string; contactId: string }) => {
      const response = await fetch(`/api/calendar/events/${eventId}/link-contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ contactId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to link event to contact");
      }

      const data = await response.json();
      return data.event as CalendarEvent;
    },
    onSuccess: (updatedEvent, variables) => {
      // Invalidate all calendar events queries to refetch with updated data
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      
      // Optimistically update the specific event in cache if it exists
      queryClient.setQueriesData(
        { queryKey: ["calendar-events"] },
        (oldData: CalendarEvent[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map((event) =>
            event.eventId === variables.eventId ? updatedEvent : event
          );
        }
      );
    },
    onError: (error) => {
      reportException(error, {
        context: "Linking calendar event to contact",
        tags: { component: "useLinkEventToContact" },
      });
    },
  });
}

/**
 * Mutation hook to unlink a calendar event from its contact
 */
export function useUnlinkEventFromContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch(`/api/calendar/events/${eventId}/unlink-contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to unlink event from contact");
      }

      const data = await response.json();
      return data.event as CalendarEvent;
    },
    onSuccess: (updatedEvent, eventId) => {
      // Invalidate all calendar events queries to refetch with updated data
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      
      // Optimistically update the specific event in cache if it exists
      queryClient.setQueriesData(
        { queryKey: ["calendar-events"] },
        (oldData: CalendarEvent[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map((event) =>
            event.eventId === eventId ? updatedEvent : event
          );
        }
      );
    },
    onError: (error) => {
      reportException(error, {
        context: "Unlinking calendar event from contact",
        tags: { component: "useUnlinkEventFromContact" },
      });
    },
  });
}

