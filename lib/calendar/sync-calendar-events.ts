import { Firestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { GoogleCalendarEvent } from "./get-calendar-events";
import { CalendarEvent, Contact } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";
import { matchEventToContact } from "./match-event-to-contact";

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
 * Optionally matches events to contacts and stores contact snapshots
 * @param timeMin - Start of sync range (only delete events within this range)
 * @param timeMax - End of sync range (only delete events within this range)
 */
export async function syncCalendarEventsToFirestore(
  db: Firestore,
  userId: string,
  events: GoogleCalendarEvent[],
  contacts?: Contact[], // Optional: if provided, will match events to contacts
  timeMin?: Date, // Optional: start of sync range for cleanup
  timeMax?: Date, // Optional: end of sync range for cleanup
  userEmail?: string | null // Optional: user's email to exclude from matching
): Promise<{ synced: number; errors: string[]; deleted: number }> {
  const errors: string[] = [];
  let synced = 0;
  let deleted = 0;

  const eventsCollection = db
    .collection("users")
    .doc(userId)
    .collection("calendarEvents");

  // Create a set of Google event IDs that exist in the sync
  const googleEventIds = new Set(events.map(e => e.id));

  // Find events in Firestore that are from Google but no longer exist in Google Calendar
  // Also check events that were created from CRM but synced to Google (they have googleEventId)
  // Only delete events that:
  // 1. Have a googleEventId that matches an event that was synced before
  // 2. Are within the sync time range (if time range is provided)
  if (timeMin && timeMax) {
    try {
      const timeMinTimestamp = Timestamp.fromDate(timeMin);
      const timeMaxTimestamp = Timestamp.fromDate(timeMax);
      
      // Query all events (we'll filter in memory for events with googleEventId)
      // This ensures we catch both Google-sourced events and CRM-created events that were synced to Google
      const existingEventsSnapshot = await eventsCollection.get();
      
      for (const doc of existingEventsSnapshot.docs) {
        const eventData = doc.data() as CalendarEvent;
        
        // Only process events that have a googleEventId (were synced to/from Google Calendar)
        // Skip events that were only created in CRM and never synced to Google
        const eventGoogleEventId = eventData.googleEventId;
        if (!eventGoogleEventId) {
          continue; // Skip events without googleEventId
        }
        
        // Check if event is within the sync time range
        const eventStartTime = eventData.startTime;
        let eventStartTimestamp: Timestamp | null = null;
        
        if (eventStartTime instanceof Timestamp) {
          eventStartTimestamp = eventStartTime;
        } else if (eventStartTime instanceof Date) {
          eventStartTimestamp = Timestamp.fromDate(eventStartTime);
        } else if (eventStartTime && typeof eventStartTime === "object" && "toDate" in eventStartTime) {
          eventStartTimestamp = Timestamp.fromDate((eventStartTime as { toDate: () => Date }).toDate());
        }
        
        // Check if event is in range
        let isInRange = true;
        if (eventStartTimestamp) {
          const eventMillis = eventStartTimestamp.toMillis();
          const minMillis = timeMinTimestamp.toMillis();
          const maxMillis = timeMaxTimestamp.toMillis();
          isInRange = 
            eventMillis >= minMillis &&
            eventMillis <= maxMillis;
        } else {
          // If we can't determine the time, skip it
          continue;
        }
        
        if (!isInRange) {
          continue;
        }
        
        // Check if this event is in Google Calendar response
        // Also check document ID as fallback (some events might use doc.id as googleEventId)
        const isInGoogle = googleEventIds.has(eventGoogleEventId) || googleEventIds.has(doc.id);
        if (isInGoogle) {
          continue;
        }
        
        // If this event is in range but not in the Google Calendar response, it was deleted
        try {
          await doc.ref.delete();
          deleted++;
        } catch (deleteError) {
          const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError);
          errors.push(`Failed to delete event ${doc.id}: ${errorMessage}`);
          reportException(deleteError, {
            context: "Deleting calendar event during cleanup",
            tags: { component: "sync-calendar-events", userId, eventId: doc.id },
          });
        }
      }
    } catch (cleanupError) {
      // Log but don't fail sync if cleanup fails
      const errorMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      errors.push(`Failed to cleanup deleted events: ${errorMessage}`);
      reportException(cleanupError, {
        context: "Cleaning up deleted calendar events",
        tags: { component: "sync-calendar-events", userId },
      });
    }
  }

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

      // Convert Google's updated timestamp to Firestore Timestamp if present
      let googleUpdated: Timestamp | undefined;
      if (googleEvent.updated) {
        googleUpdated = Timestamp.fromDate(new Date(googleEvent.updated));
      }

      // Prepare base event data
      const eventData: Omit<CalendarEvent, 'eventId'> = {
        googleEventId: googleEvent.id,
        userId,
        title: googleEvent.summary || "(No title)",
        description: googleEvent.description || null,
        startTime: startTime,
        endTime: endTime,
        location: googleEvent.location || null,
        attendees: googleEvent.attendees?.map((a) => {
          const attendee: { email: string; displayName?: string } = {
            email: a.email,
          };
          // Only include displayName if it exists (Firestore doesn't accept undefined)
          if (a.displayName) {
            attendee.displayName = a.displayName;
          }
          return attendee;
        }) || [],
        lastSyncedAt: FieldValue.serverTimestamp(),
        etag: googleEvent.etag,
        googleUpdated: googleUpdated || FieldValue.serverTimestamp(), // Use Google's updated time or fallback to now
        sourceOfTruth: "google", // All events synced from Google have this source
        isDirty: false, // Newly synced events are clean
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Check if event already exists to preserve manual match overrides
      const existingEventDoc = await eventsCollection.doc(googleEvent.id).get();
      const existingEvent = existingEventDoc.exists
        ? (existingEventDoc.data() as CalendarEvent)
        : null;

      // Match event to contact if contacts are provided
      if (contacts && contacts.length > 0) {
        // Create a CalendarEvent-like object for matching (with eventId from googleEvent.id)
        const eventForMatching: CalendarEvent = {
          eventId: googleEvent.id,
          ...eventData,
        } as CalendarEvent;

        // Use userEmail parameter (passed from caller)
        const eventUserEmail = userEmail || null;

        const match = matchEventToContact(eventForMatching, contacts, eventUserEmail);

        // Only auto-link if:
        // 1. High confidence match (exact email match)
        // 2. No existing manual override (matchOverriddenByUser !== true)
        if (
          match.confidence === "high" &&
          match.contactId &&
          existingEvent?.matchOverriddenByUser !== true
        ) {
          // Find the matched contact
          const matchedContact = contacts.find(
            (c) => c.contactId === match.contactId
          );

          if (matchedContact) {
            eventData.matchedContactId = match.contactId;
            eventData.matchConfidence = match.confidence;
            // Map match method to CalendarEvent matchMethod type
            // "lastname" and "firstname" both map to "name" (name-based matching)
            eventData.matchMethod = match.method === "lastname" || match.method === "firstname" 
              ? "name" 
              : match.method === "email" 
                ? "email" 
                : match.method === "manual" 
                  ? "manual" 
                  : undefined;

            // Create contact snapshot
            eventData.contactSnapshot = {
              name: `${matchedContact.firstName || ""} ${matchedContact.lastName || ""}`.trim() || matchedContact.primaryEmail,
              segment: matchedContact.segment || null,
              tags: matchedContact.tags || [],
              primaryEmail: matchedContact.primaryEmail,
              engagementScore: matchedContact.engagementScore || null,
              snapshotUpdatedAt: FieldValue.serverTimestamp(),
            };
          }
        }
        // Note: Medium/low confidence matches are only in suggestions, not stored as matchedContactId
      }

      // Preserve existing manual overrides and denied contact IDs
      if (existingEvent) {
        if (existingEvent.matchOverriddenByUser) {
          eventData.matchOverriddenByUser = true;
          // Preserve existing matchedContactId if user manually set it
          if (existingEvent.matchedContactId) {
            eventData.matchedContactId = existingEvent.matchedContactId;
            eventData.matchMethod = existingEvent.matchMethod || "manual";
          }
        }
        if (existingEvent.matchDeniedContactIds) {
          eventData.matchDeniedContactIds = existingEvent.matchDeniedContactIds;
        }
      }

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

  return { synced, errors, deleted };
}

