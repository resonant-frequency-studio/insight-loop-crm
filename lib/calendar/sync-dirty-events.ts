import { Firestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getCalendarAccessToken } from "./get-access-token";
import { updateGoogleEvent } from "./write-calendar-event";
import { GoogleCalendarClient } from "./google-calendar-client";
import { CalendarEvent } from "@/types/firestore";
import { lockEventForSync, unlockEventAfterSync, canSyncEvent } from "./sync-state-tracker";
import { reportException } from "@/lib/error-reporting";

/**
 * Format a Date as YYYY-MM-DD for all-day events
 */
function formatDateForAllDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Sync a single dirty event from CRM to Google Calendar
 */
export async function syncDirtyEventToGoogle(
  db: Firestore,
  userId: string,
  event: CalendarEvent
): Promise<{ success: boolean; error?: string; conflict?: boolean }> {
  const eventsCollection = db
    .collection("users")
    .doc(userId)
    .collection("calendarEvents");

  // Check if event can be synced
  const syncCheck = canSyncEvent(event, "crm");
  if (!syncCheck.canSync) {
    return {
      success: false,
      error: syncCheck.reason || "Event cannot be synced",
    };
  }

  // Lock event for sync
  const locked = await lockEventForSync(db, userId, event.eventId);
  if (!locked) {
    return {
      success: false,
      error: "Event is locked or already being synced",
    };
  }

  try {
    const accessToken = await getCalendarAccessToken(userId, true);

    // Check if event has googleEventId (was previously synced)
    if (event.googleEventId) {
      // Update existing event in Google Calendar
      try {
        const result = await updateGoogleEvent({
          userId,
          googleEventId: event.googleEventId,
          title: event.title,
          description: event.description || undefined,
          startTime: event.startTime instanceof Timestamp
            ? event.startTime.toDate()
            : event.startTime instanceof Date
            ? event.startTime
            : (event.startTime as { toDate: () => Date }).toDate(),
          endTime: event.endTime instanceof Timestamp
            ? event.endTime.toDate()
            : event.endTime instanceof Date
            ? event.endTime
            : (event.endTime as { toDate: () => Date }).toDate(),
          location: event.location || undefined,
          attendees: event.attendees?.map((a) => a.email),
          etag: event.etag,
        });

        // Check if there's a conflict
        if ("conflict" in result && result.conflict) {
          // Mark event as having conflict
          await eventsCollection.doc(event.eventId).update({
            hasConflict: true,
            conflictType: "complex",
            conflictDetectedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });

          await unlockEventAfterSync(db, userId, event.eventId, "crm", false);
          return { success: false, conflict: true, error: "Conflict detected" };
        }

        // Success - update event
        const googleEvent = result as import("./google-calendar-client").GoogleCalendarEvent;
        const googleUpdated = googleEvent.updated
          ? Timestamp.fromDate(new Date(googleEvent.updated))
          : FieldValue.serverTimestamp();

        await eventsCollection.doc(event.eventId).update({
          isDirty: false,
          etag: googleEvent.etag,
          googleUpdated: googleUpdated as Timestamp,
          lastSyncedAt: FieldValue.serverTimestamp(),
          hasConflict: false,
          conflictType: null,
          conflictDetectedAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        });

        await unlockEventAfterSync(db, userId, event.eventId, "crm", true);
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        reportException(error, {
          context: "Updating Google Calendar event",
          tags: { component: "sync-dirty-events", userId, eventId: event.eventId },
        });

        await unlockEventAfterSync(db, userId, event.eventId, "crm", false);
        return { success: false, error: errorMessage };
      }
    } else {
      // Create new event in Google Calendar
      try {
        const startTime = event.startTime instanceof Timestamp
          ? event.startTime.toDate()
          : event.startTime instanceof Date
          ? event.startTime
          : (event.startTime as { toDate: () => Date }).toDate();
        const endTime = event.endTime instanceof Timestamp
          ? event.endTime.toDate()
          : event.endTime instanceof Date
          ? event.endTime
          : (event.endTime as { toDate: () => Date }).toDate();

        const isAllDay = startTime.getHours() === 0 && startTime.getMinutes() === 0 &&
                         endTime.getHours() === 0 && endTime.getMinutes() === 0 &&
                         (endTime.getTime() - startTime.getTime()) >= 23 * 60 * 60 * 1000;

        const client = new GoogleCalendarClient(accessToken);
        const calendarId = "primary";

        let payload: import("./google-calendar-client").GoogleCalendarEventPayload;
        if (isAllDay) {
          const startDate = formatDateForAllDay(startTime);
          const endDate = formatDateForAllDay(endTime);
          const endDateObj = new Date(endDate);
          endDateObj.setDate(endDateObj.getDate() + 1);
          const endDateExclusive = formatDateForAllDay(endDateObj);

          payload = {
            summary: event.title,
            description: event.description || undefined,
            location: event.location || undefined,
            start: { date: startDate },
            end: { date: endDateExclusive },
          };
        } else {
          payload = {
            summary: event.title,
            description: event.description || undefined,
            location: event.location || undefined,
            start: {
              dateTime: startTime.toISOString(),
              timeZone: "UTC",
            },
            end: {
              dateTime: endTime.toISOString(),
              timeZone: "UTC",
            },
          };
        }

        if (event.attendees && event.attendees.length > 0) {
          payload.attendees = event.attendees.map((a) => ({ email: a.email }));
        }

        const googleEvent = await client.createEvent(calendarId, payload);

        // Update event with googleEventId
        const googleUpdated = googleEvent.updated
          ? Timestamp.fromDate(new Date(googleEvent.updated))
          : FieldValue.serverTimestamp();

        await eventsCollection.doc(event.eventId).update({
          googleEventId: googleEvent.id,
          isDirty: false,
          etag: googleEvent.etag,
          googleUpdated: googleUpdated as Timestamp,
          lastSyncedAt: FieldValue.serverTimestamp(),
          sourceOfTruth: "crm_touchpoint",
          updatedAt: FieldValue.serverTimestamp(),
        });

        await unlockEventAfterSync(db, userId, event.eventId, "crm", true);
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        reportException(error, {
          context: "Creating Google Calendar event",
          tags: { component: "sync-dirty-events", userId, eventId: event.eventId },
        });

        await unlockEventAfterSync(db, userId, event.eventId, "crm", false);
        return { success: false, error: errorMessage };
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    reportException(error, {
      context: "Syncing dirty event to Google",
      tags: { component: "sync-dirty-events", userId, eventId: event.eventId },
    });

    await unlockEventAfterSync(db, userId, event.eventId, "crm", false);
    return { success: false, error: errorMessage };
  }
}

/**
 * Sync all dirty events from CRM to Google Calendar
 */
export async function syncAllDirtyEvents(
  db: Firestore,
  userId: string,
  limit: number = 50
): Promise<{ synced: number; errors: number; conflicts: number }> {
  const eventsCollection = db
    .collection("users")
    .doc(userId)
    .collection("calendarEvents");

  // Query for dirty events
  const dirtyEventsSnapshot = await eventsCollection
    .where("isDirty", "==", true)
    .where("sourceOfTruth", "==", "crm_touchpoint")
    .where("syncInProgress", "!=", true) // Exclude events already being synced
    .limit(limit)
    .get();

  let synced = 0;
  let errors = 0;
  let conflicts = 0;

  for (const doc of dirtyEventsSnapshot.docs) {
    const event = { ...doc.data(), eventId: doc.id } as CalendarEvent;

    const result = await syncDirtyEventToGoogle(db, userId, event);

    if (result.success) {
      synced++;
    } else if (result.conflict) {
      conflicts++;
    } else {
      errors++;
    }
  }

  return { synced, errors, conflicts };
}

