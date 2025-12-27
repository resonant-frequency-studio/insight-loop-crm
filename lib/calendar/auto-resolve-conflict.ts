import { Firestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { CalendarEvent } from "@/types/firestore";
import { GoogleCalendarEvent } from "./google-calendar-client";
import { detectConflict, ConflictInfo } from "./conflict-detector";
import { reportException } from "@/lib/error-reporting";

/**
 * Auto-resolve a simple conflict by updating the CRM event from Google
 */
export async function autoResolveConflictFromGoogle(
  db: Firestore,
  userId: string,
  googleEvent: GoogleCalendarEvent,
  crmEvent: CalendarEvent
): Promise<void> {
  const eventsCollection = db
    .collection("users")
    .doc(userId)
    .collection("calendarEvents");

  // Convert Google event dates to Firestore Timestamps
  const isAllDay = !googleEvent.start.dateTime && !!googleEvent.start.date;

  let startTimestamp: Timestamp;
  let endTimestamp: Timestamp;

  if (isAllDay) {
    const [startYear, startMonth, startDay] = (googleEvent.start.date || "").split("-").map(Number);
    const [endYear, endMonth, endDay] = (googleEvent.end.date || "").split("-").map(Number);
    
    startTimestamp = Timestamp.fromDate(new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0)));
    
    const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));
    endDate.setUTCDate(endDate.getUTCDate() - 1);
    endDate.setUTCHours(23, 59, 59, 999);
    endTimestamp = Timestamp.fromDate(endDate);
  } else {
    startTimestamp = Timestamp.fromDate(new Date(googleEvent.start.dateTime!));
    endTimestamp = Timestamp.fromDate(new Date(googleEvent.end.dateTime!));
  }

  const googleUpdated = googleEvent.updated
    ? Timestamp.fromDate(new Date(googleEvent.updated))
    : FieldValue.serverTimestamp();

  // Update CRM event with Google's data
  const updateData: Partial<CalendarEvent> = {
    title: googleEvent.summary || crmEvent.title,
    description: googleEvent.description !== undefined ? (googleEvent.description || null) : undefined,
    location: googleEvent.location !== undefined ? (googleEvent.location || null) : undefined,
    attendees: googleEvent.attendees?.map((a) => {
      const attendee: { email: string; displayName?: string } = {
        email: a.email,
      };
      if (a.displayName) {
        attendee.displayName = a.displayName;
      }
      return attendee;
    }),
    startTime: startTimestamp,
    endTime: endTimestamp,
    lastSyncedAt: FieldValue.serverTimestamp(),
    etag: googleEvent.etag,
    googleUpdated: googleUpdated as Timestamp,
    isDirty: false, // Event is now in sync
    sourceOfTruth: "google",
    updatedAt: FieldValue.serverTimestamp(),
    // Preserve contact matching and other CRM-specific fields
    matchedContactId: crmEvent.matchedContactId,
    matchConfidence: crmEvent.matchConfidence,
    matchMethod: crmEvent.matchMethod,
    contactSnapshot: crmEvent.contactSnapshot,
  };

  await eventsCollection.doc(crmEvent.eventId).update(updateData);
}

/**
 * Check if a conflict can be auto-resolved
 */
export function canAutoResolve(conflictInfo: ConflictInfo): boolean {
  return conflictInfo.type === "simple";
}

/**
 * Auto-resolve conflict if possible
 * Returns true if conflict was resolved, false if user intervention is needed
 */
export async function tryAutoResolveConflict(
  db: Firestore,
  userId: string,
  googleEvent: GoogleCalendarEvent,
  crmEvent: CalendarEvent
): Promise<{ resolved: boolean; conflictInfo: ConflictInfo }> {
  const conflictInfo = detectConflict(googleEvent, crmEvent);

  if (!canAutoResolve(conflictInfo)) {
    return { resolved: false, conflictInfo };
  }

  try {
    // Auto-resolve: update CRM from Google
    if (conflictInfo.reason === "only_google_changed") {
      await autoResolveConflictFromGoogle(db, userId, googleEvent, crmEvent);
      return { resolved: true, conflictInfo };
    }

    // For "only_crm_changed", we don't auto-resolve here
    // This will be handled by the dirty event sync job
    return { resolved: false, conflictInfo };
  } catch (error) {
    reportException(error, {
      context: "Auto-resolving conflict",
      tags: { component: "auto-resolve-conflict", userId, eventId: crmEvent.eventId },
    });
    return { resolved: false, conflictInfo };
  }
}

