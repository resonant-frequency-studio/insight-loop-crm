import { Firestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { GoogleCalendarEvent } from "./get-calendar-events";
import { CalendarEvent } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

/**
 * Convert Google Calendar date format to Firestore Timestamp
 * Handles both timed events (dateTime) and all-day events (date)
 * 
 * For all-day events: Google Calendar's end.date is exclusive (next day).
 * We store all-day events in UTC at midnight to avoid timezone conversion issues.
 * For single-day all-day events, end date is set to same day at 23:59:59.999 UTC.
 */
function convertGoogleCalendarDateToTimestamp(
  dateTime?: string,
  date?: string,
  isEndDate: boolean = false,
  isAllDay: boolean = false
): Timestamp {
  let dateObj: Date;
  if (dateTime) {
    // Timed event - use the exact dateTime (includes timezone info)
    dateObj = new Date(dateTime);
  } else if (date) {
    // All-day event - use date only (YYYY-MM-DD)
    // Parse as UTC date to avoid timezone shifts
    const [year, month, day] = date.split('-').map(Number);
    if (isEndDate && isAllDay) {
      // For end dates of all-day events, Google Calendar gives us the exclusive next day
      // Convert to end of the previous day (23:59:59.999 UTC)
      // This correctly represents the last day of a multi-day all-day event
      const endDate = new Date(Date.UTC(year, month - 1, day)); // month is 0-indexed
      endDate.setUTCDate(endDate.getUTCDate() - 1); // Go back one day (exclusive date)
      endDate.setUTCHours(23, 59, 59, 999); // Set to end of that day in UTC
      dateObj = endDate;
    } else {
      // For start dates, use start of day in UTC (00:00:00 UTC)
      dateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    }
  } else {
    throw new Error("Event must have either dateTime or date");
  }
  return Timestamp.fromDate(dateObj);
}

/**
 * Sync calendar events from Google Calendar to Firestore
 */
export async function syncCalendarEventsToFirestore(
  db: Firestore,
  userId: string,
  events: GoogleCalendarEvent[],
  calendarId: string = 'primary'
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  const eventsCollection = db
    .collection("users")
    .doc(userId)
    .collection("calendarEvents");

  for (const googleEvent of events) {
    try {
      // Skip cancelled events
      if (googleEvent.status === "cancelled") {
        // Remove from Firestore if it exists
        try {
          await eventsCollection.doc(googleEvent.id).delete();
        } catch {
          // Ignore if doesn't exist
        }
        continue;
      }

      // Convert dates to Firestore Timestamps
      // Check if this is an all-day event (has date but no dateTime)
      const isAllDay = !googleEvent.start.dateTime && !!googleEvent.start.date;
      
      const startTime = convertGoogleCalendarDateToTimestamp(
        googleEvent.start.dateTime,
        googleEvent.start.date,
        false, // isEndDate = false
        isAllDay
      );
      const endTime = convertGoogleCalendarDateToTimestamp(
        googleEvent.end.dateTime,
        googleEvent.end.date,
        true, // isEndDate = true
        isAllDay
      );

      // Prepare event data
      const eventData: Omit<CalendarEvent, 'eventId'> = {
        googleEventId: googleEvent.id,
        userId,
        title: googleEvent.summary || "(No title)",
        description: googleEvent.description || null,
        startTime: startTime,
        endTime: endTime,
        location: googleEvent.location || null,
        attendees: googleEvent.attendees?.map((a) => ({
          email: a.email,
          displayName: a.displayName || null, // Convert undefined to null for Firestore
        })) || [],
        lastSyncedAt: FieldValue.serverTimestamp(),
        etag: googleEvent.etag,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Upsert event (use googleEventId as document ID for easy lookup)
      await eventsCollection.doc(googleEvent.id).set(eventData, { merge: true });
      synced++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to sync event ${googleEvent.id}: ${errorMessage}`);
      reportException(error, {
        context: "Syncing calendar event to Firestore",
        tags: { component: "sync-calendar-events", userId, eventId: googleEvent.id },
      });
    }
  }

  return { synced, errors };
}

