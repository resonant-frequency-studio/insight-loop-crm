import { GoogleCalendarClient, GoogleCalendarEventPayload, GoogleCalendarEvent } from "./google-calendar-client";
import { getCalendarAccessToken } from "./get-access-token";
import { reportException } from "@/lib/error-reporting";

export interface CreateEventOptions {
  userId: string;
  calendarId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[]; // Email addresses
  isAllDay?: boolean;
  timeZone?: string;
}

export interface UpdateEventOptions {
  userId: string;
  calendarId?: string;
  googleEventId: string;
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  attendees?: string[];
  isAllDay?: boolean;
  timeZone?: string;
  etag?: string; // For conflict detection
}

export interface DeleteEventOptions {
  userId: string;
  calendarId?: string;
  googleEventId: string;
  etag?: string; // For conflict detection
}

export interface ConflictResponse {
  conflict: true;
  reason: "etag_mismatch";
  googleEvent: GoogleCalendarEvent;
  localEvent: Partial<GoogleCalendarEventPayload>;
  cachedEvent?: {
    etag?: string;
    googleUpdated?: string;
  };
}

/**
 * Create a new Google Calendar event
 */
export async function createGoogleEvent(
  options: CreateEventOptions
): Promise<GoogleCalendarEvent> {
  try {
    const accessToken = await getCalendarAccessToken(options.userId, true); // requireWriteScope: true
    const client = new GoogleCalendarClient(accessToken);
    const calendarId = options.calendarId || "primary";

    // Build payload with required start/end fields
    let payload: GoogleCalendarEventPayload;

    // Handle all-day vs timed events
    if (options.isAllDay) {
      // All-day events use date format (YYYY-MM-DD)
      const startDate = formatDateForAllDay(options.startTime);
      const endDate = formatDateForAllDay(options.endTime);
      
      // Google Calendar's end.date is exclusive (next day)
      // If it's a single-day event, we need to add one day to end
      const endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateExclusive = formatDateForAllDay(endDateObj);

      payload = {
        summary: options.title,
        description: options.description,
        location: options.location,
        start: { date: startDate },
        end: { date: endDateExclusive },
      };
    } else {
      // Timed events use dateTime format (ISO 8601)
      payload = {
        summary: options.title,
        description: options.description,
        location: options.location,
        start: {
          dateTime: options.startTime.toISOString(),
          timeZone: options.timeZone || "UTC",
        },
        end: {
          dateTime: options.endTime.toISOString(),
          timeZone: options.timeZone || "UTC",
        },
      };
    }

    // Add attendees if provided
    if (options.attendees && options.attendees.length > 0) {
      payload.attendees = options.attendees.map((email) => ({ email }));
    }

    return await client.createEvent(calendarId, payload);
  } catch (error) {
    reportException(error, {
      context: "Creating Google Calendar event",
      tags: { component: "write-calendar-event", userId: options.userId },
    });
    throw error;
  }
}

/**
 * Update an existing Google Calendar event
 * Uses etag for conflict detection if provided
 */
export async function updateGoogleEvent(
  options: UpdateEventOptions
): Promise<GoogleCalendarEvent | ConflictResponse> {
  try {
    const accessToken = await getCalendarAccessToken(options.userId, true); // requireWriteScope: true
    const client = new GoogleCalendarClient(accessToken);
    const calendarId = options.calendarId || "primary";

    // Build partial payload
    const payload: Partial<GoogleCalendarEventPayload> = {};

    if (options.title !== undefined) {
      payload.summary = options.title;
    }
    if (options.description !== undefined) {
      payload.description = options.description;
    }
    if (options.location !== undefined) {
      payload.location = options.location;
    }

    // Handle date/time updates
    if (options.startTime || options.endTime) {
      if (options.isAllDay) {
        // All-day event format
        if (options.startTime) {
          const startDate = formatDateForAllDay(options.startTime);
          payload.start = { date: startDate };
        }
        if (options.endTime) {
          // Google Calendar's end.date is exclusive
          const endDateObj = new Date(options.endTime);
          endDateObj.setDate(endDateObj.getDate() + 1);
          const endDateExclusive = formatDateForAllDay(endDateObj);
          payload.end = { date: endDateExclusive };
        }
      } else {
        // Timed event format
        if (options.startTime) {
          payload.start = {
            dateTime: options.startTime.toISOString(),
            timeZone: options.timeZone || "UTC",
          };
        }
        if (options.endTime) {
          payload.end = {
            dateTime: options.endTime.toISOString(),
            timeZone: options.timeZone || "UTC",
          };
        }
      }
    }

    // Handle attendees
    if (options.attendees !== undefined) {
      payload.attendees = options.attendees.map((email) => ({ email }));
    }

    try {
      const updatedEvent = await client.updateEvent(
        calendarId,
        options.googleEventId,
        payload,
        options.etag
      );
      return updatedEvent;
    } catch (error) {
      // Check if this is a conflict error
      const conflictError = error as Error & {
        conflict?: boolean;
        statusCode?: number;
      };

      if (conflictError.conflict || conflictError.statusCode === 409 || conflictError.statusCode === 412) {
        // Fetch the current Google event to return in conflict response
        try {
          const currentGoogleEvent = await client.getEvent(calendarId, options.googleEventId);
          return {
            conflict: true,
            reason: "etag_mismatch",
            googleEvent: currentGoogleEvent,
            localEvent: payload,
            cachedEvent: {
              etag: options.etag,
            },
          };
        } catch (fetchError) {
          // If we can't fetch the current event, still return conflict response
          reportException(fetchError, {
            context: "Failed to fetch Google event during conflict",
            tags: { component: "write-calendar-event", userId: options.userId },
          });
          return {
            conflict: true,
            reason: "etag_mismatch",
            googleEvent: {} as GoogleCalendarEvent, // Empty as fallback
            localEvent: payload,
            cachedEvent: {
              etag: options.etag,
            },
          };
        }
      }

      // Re-throw non-conflict errors
      throw error;
    }
  } catch (error) {
    reportException(error, {
      context: "Updating Google Calendar event",
      tags: { component: "write-calendar-event", userId: options.userId },
    });
    throw error;
  }
}

/**
 * Delete a Google Calendar event
 */
export async function deleteGoogleEvent(
  options: DeleteEventOptions
): Promise<void> {
  try {
    const accessToken = await getCalendarAccessToken(options.userId, true); // requireWriteScope: true
    const client = new GoogleCalendarClient(accessToken);
    const calendarId = options.calendarId || "primary";

    await client.deleteEvent(calendarId, options.googleEventId, options.etag);
  } catch (error) {
    reportException(error, {
      context: "Deleting Google Calendar event",
      tags: { component: "write-calendar-event", userId: options.userId },
    });
    throw error;
  }
}

/**
 * Format a Date as YYYY-MM-DD for all-day events
 */
function formatDateForAllDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

