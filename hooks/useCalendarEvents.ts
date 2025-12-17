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

export interface EventContext {
  summary: string;
  suggestedNextStep: string;
  suggestedTouchpointDate?: string;
  suggestedTouchpointRationale?: string;
  suggestedActionItems?: string[];
  followUpEmailDraft?: string;
}

/**
 * Mutation hook to generate AI context for a calendar event
 */
export function useGenerateEventContext() {
  return useMutation({
    mutationFn: async (eventId: string): Promise<EventContext> => {
      const response = await fetch(`/api/calendar/events/${eventId}/ai-context`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate AI context");
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || "Failed to generate AI context");
      }

      return {
        summary: data.summary,
        suggestedNextStep: data.suggestedNextStep,
        suggestedTouchpointDate: data.suggestedTouchpointDate,
        suggestedTouchpointRationale: data.suggestedTouchpointRationale,
        suggestedActionItems: data.suggestedActionItems,
        followUpEmailDraft: data.followUpEmailDraft,
      };
    },
    onError: (error) => {
      reportException(error, {
        context: "Generating AI context for calendar event",
        tags: { component: "useGenerateEventContext" },
      });
    },
  });
}

export interface CreateEventInput {
  title: string;
  description?: string;
  startTime: string; // ISO date string
  endTime: string; // ISO date string
  location?: string;
  attendees?: string[];
  contactId?: string;
  isAllDay?: boolean;
  timeZone?: string;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  startTime?: string; // ISO date string
  endTime?: string; // ISO date string
  location?: string;
  attendees?: string[];
  isAllDay?: boolean;
  timeZone?: string;
}

/**
 * Mutation hook to create a new calendar event
 * Uses optimistic updates with isDirty flag
 */
export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateEventInput): Promise<CalendarEvent> => {
      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || "Failed to create calendar event");
        // Attach requiresReauth flag if present
        if (errorData.requiresReauth) {
          (error as Error & { requiresReauth?: boolean }).requiresReauth = true;
        }
        throw error;
      }

      const data = await response.json();
      if (!data.ok) {
        const error = new Error(data.error || "Failed to create calendar event");
        // Attach requiresReauth flag if present
        if (data.requiresReauth) {
          (error as Error & { requiresReauth?: boolean }).requiresReauth = true;
        }
        throw error;
      }

      return data.event as CalendarEvent;
    },
    onMutate: async (newEvent) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["calendar-events"] });

      // Snapshot the previous value
      const previousEvents = queryClient.getQueriesData<CalendarEvent[]>({
        queryKey: ["calendar-events"],
      });

      // Optimistically add the new event with isDirty=true
      const optimisticEvent: CalendarEvent = {
        eventId: `temp-${Date.now()}`,
        googleEventId: `temp-${Date.now()}`,
        userId: "", // Will be set by server
        title: newEvent.title,
        description: newEvent.description || null,
        startTime: new Date(newEvent.startTime),
        endTime: new Date(newEvent.endTime),
        location: newEvent.location || null,
        attendees: newEvent.attendees?.map((email) => ({ email })) || [],
        lastSyncedAt: new Date(),
        isDirty: true,
        sourceOfTruth: "crm_touchpoint",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Optimistically update all calendar event queries
      queryClient.setQueriesData<CalendarEvent[]>(
        { queryKey: ["calendar-events"] },
        (oldData) => {
          if (!oldData) return [optimisticEvent];
          return [...oldData, optimisticEvent];
        }
      );

      return { previousEvents };
    },
    onSuccess: (createdEvent) => {
      // Replace optimistic event with real event from server
      queryClient.setQueriesData<CalendarEvent[]>(
        { queryKey: ["calendar-events"] },
        (oldData) => {
          if (!oldData) return [createdEvent];
          // Remove optimistic event and add real one
          return oldData
            .filter((e) => !e.eventId.startsWith("temp-"))
            .concat(createdEvent);
        }
      );

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousEvents) {
        context.previousEvents.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      reportException(error, {
        context: "Creating calendar event",
        tags: { component: "useCreateCalendarEvent" },
      });
    },
  });
}

/**
 * Mutation hook to update an existing calendar event
 * Uses optimistic updates with isDirty flag
 */
export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      updates,
    }: {
      eventId: string;
      updates: UpdateEventInput;
    }): Promise<CalendarEvent> => {
      const response = await fetch(`/api/calendar/events/${eventId}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check if this is a conflict response
        if (response.status === 409 && errorData.conflict) {
          const conflictError = new Error(errorData.error || "Event conflict detected") as Error & {
            conflict?: boolean;
            conflictData?: unknown;
          };
          conflictError.conflict = true;
          conflictError.conflictData = errorData;
          throw conflictError;
        }

        throw new Error(errorData.error || "Failed to update calendar event");
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || "Failed to update calendar event");
      }

      return data.event as CalendarEvent;
    },
    onMutate: async ({ eventId, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["calendar-events"] });

      // Snapshot the previous value
      const previousEvents = queryClient.getQueriesData<CalendarEvent[]>({
        queryKey: ["calendar-events"],
      });

      // Optimistically update the event with isDirty=true
      queryClient.setQueriesData<CalendarEvent[]>(
        { queryKey: ["calendar-events"] },
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.map((event) => {
            if (event.eventId === eventId) {
              return {
                ...event,
                ...updates,
                startTime: updates.startTime ? new Date(updates.startTime) : event.startTime,
                endTime: updates.endTime ? new Date(updates.endTime) : event.endTime,
                attendees: updates.attendees?.map((email) => ({ email })) || event.attendees,
                isDirty: true,
                updatedAt: new Date(),
              };
            }
            return event;
          });
        }
      );

      return { previousEvents };
    },
    onSuccess: (updatedEvent, variables) => {
      // Update with real event from server (with fresh etag, isDirty=false)
      queryClient.setQueriesData<CalendarEvent[]>(
        { queryKey: ["calendar-events"] },
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.map((event) =>
            event.eventId === variables.eventId ? updatedEvent : event
          );
        }
      );

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousEvents) {
        context.previousEvents.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      reportException(error, {
        context: "Updating calendar event",
        tags: { component: "useUpdateCalendarEvent" },
      });
    },
  });
}

/**
 * Mutation hook to delete a calendar event
 * Uses optimistic updates
 */
export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string): Promise<void> => {
      const response = await fetch(`/api/calendar/events/${eventId}/delete`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete calendar event");
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || "Failed to delete calendar event");
      }
    },
    onMutate: async (eventId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["calendar-events"] });

      // Snapshot the previous value
      const previousEvents = queryClient.getQueriesData<CalendarEvent[]>({
        queryKey: ["calendar-events"],
      });

      // Optimistically remove the event
      queryClient.setQueriesData<CalendarEvent[]>(
        { queryKey: ["calendar-events"] },
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.filter((event) => event.eventId !== eventId);
        }
      );

      return { previousEvents };
    },
    onSuccess: () => {
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (error, eventId, context) => {
      // Rollback optimistic update
      if (context?.previousEvents) {
        context.previousEvents.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      reportException(error, {
        context: "Deleting calendar event",
        tags: { component: "useDeleteCalendarEvent" },
      });
    },
  });
}

