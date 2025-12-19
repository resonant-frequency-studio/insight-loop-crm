import { Firestore } from "firebase-admin/firestore";
import { CalendarEvent } from "@/types/firestore";
import { convertTimestamp } from "@/util/timestamp-utils-server";

/**
 * Get a single calendar event by ID from Firestore
 * Converts Firestore Timestamps to ISO strings for client component serialization
 */
export async function getCalendarEventById(
  db: Firestore,
  userId: string,
  eventId: string
): Promise<CalendarEvent | null> {
  const eventDoc = await db
    .collection("users")
    .doc(userId)
    .collection("calendarEvents")
    .doc(eventId)
    .get();

  if (!eventDoc.exists) {
    return null;
  }

  const data = eventDoc.data();
  if (!data) {
    return null;
  }

  // Convert all Firestore Timestamps to ISO strings for client component serialization
  return {
    eventId: eventDoc.id,
    googleEventId: data.googleEventId,
    userId: data.userId,
    title: data.title,
    description: data.description || null,
    startTime: convertTimestamp(data.startTime) as string,
    endTime: convertTimestamp(data.endTime) as string,
    location: data.location || null,
    attendees: data.attendees || [],
    lastSyncedAt: convertTimestamp(data.lastSyncedAt) as string,
    etag: data.etag || null,
    googleUpdated: data.googleUpdated ? convertTimestamp(data.googleUpdated) as string : undefined,
    sourceOfTruth: data.sourceOfTruth || "google",
    isDirty: data.isDirty ?? false,
    // Contact matching fields
    matchedContactId: data.matchedContactId ?? null,
    matchConfidence: data.matchConfidence,
    matchMethod: data.matchMethod,
    matchOverriddenByUser: data.matchOverriddenByUser ?? false,
    matchDeniedContactIds: data.matchDeniedContactIds || [],
    contactSnapshot: data.contactSnapshot ? {
      ...data.contactSnapshot,
      snapshotUpdatedAt: convertTimestamp(data.contactSnapshot.snapshotUpdatedAt) as string,
    } : null,
    meetingInsights: data.meetingInsights ? {
      ...data.meetingInsights,
      generatedAt: convertTimestamp(data.meetingInsights.generatedAt) as string,
    } : null,
    createdAt: convertTimestamp(data.createdAt) as string,
    updatedAt: convertTimestamp(data.updatedAt) as string,
  } as CalendarEvent;
}

