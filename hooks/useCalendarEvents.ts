"use client";

import { useMutation } from "@tanstack/react-query";
import { CalendarEvent } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

// Note: useCalendarEvents query hook has been replaced by useCalendarEventsRealtime
// This file now only contains mutation hooks

/**
 * Mutation hook to link a calendar event to a contact
 * Firebase listeners will automatically update the event after mutation succeeds
 */
export function useLinkEventToContact() {
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
 * Firebase listeners will automatically update the event after mutation succeeds
 */
export function useUnlinkEventFromContact() {
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
    mutationFn: async (input: { eventId: string; regenerate?: boolean }): Promise<EventContext> => {
      const url = `/api/calendar/events/${input.eventId}/ai-context${input.regenerate ? '?regenerate=true' : ''}`;
      const response = await fetch(url, {
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
 * Firebase listeners will automatically update with the new event after mutation succeeds
 */
export function useCreateCalendarEvent() {
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
    onError: (error) => {
      reportException(error, {
        context: "Creating calendar event",
        tags: { component: "useCreateCalendarEvent" },
      });
    },
  });
}

/**
 * Mutation hook to update an existing calendar event
 * Firebase listeners will automatically update the event after mutation succeeds
 */
export function useUpdateCalendarEvent() {
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
    onError: (error) => {
      reportException(error, {
        context: "Updating calendar event",
        tags: { component: "useUpdateCalendarEvent" },
      });
    },
  });
}

/**
 * Mutation hook to delete a calendar event
 * Firebase listeners will automatically remove the event after mutation succeeds
 */
export function useDeleteCalendarEvent() {
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
    onError: (error) => {
      reportException(error, {
        context: "Deleting calendar event",
        tags: { component: "useDeleteCalendarEvent" },
      });
    },
  });
}

