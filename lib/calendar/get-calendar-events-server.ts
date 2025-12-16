import { Firestore, Timestamp } from "firebase-admin/firestore";
import { CalendarEvent } from "@/types/firestore";
import { convertTimestamp } from "@/util/timestamp-utils-server";

/**
 * Get cached calendar events from Firestore for a user within a date range
 * Converts Firestore Timestamps to ISO strings for client component serialization
 */
export async function getCalendarEventsForUser(
  db: Firestore,
  userId: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const eventsCollection = db
    .collection("users")
    .doc(userId)
    .collection("calendarEvents");

  // Convert Date to Firestore Timestamp for query
  const timeMinTimestamp = Timestamp.fromDate(timeMin);
  const timeMaxTimestamp = Timestamp.fromDate(timeMax);

  // Query events where startTime is within the range
  const snapshot = await eventsCollection
    .where("startTime", ">=", timeMinTimestamp)
    .where("startTime", "<=", timeMaxTimestamp)
    .get();

  const events: CalendarEvent[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Convert Firestore timestamp to Date for comparison
    let startTime: Date;
    if (data.startTime && typeof data.startTime === "object" && "toDate" in data.startTime) {
      startTime = (data.startTime as { toDate: () => Date }).toDate();
    } else if (data.startTime instanceof Date) {
      startTime = data.startTime;
    } else {
      // Skip events with invalid start times
      continue;
    }

    // Additional filtering to ensure we're within the exact range
    if (startTime >= timeMin && startTime <= timeMax) {
      // Convert all Firestore Timestamps to ISO strings for client component serialization
      events.push({
        eventId: doc.id,
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
        createdAt: convertTimestamp(data.createdAt) as string,
        updatedAt: convertTimestamp(data.updatedAt) as string,
      } as CalendarEvent);
    }
  }

  // Sort by start time
  events.sort((a, b) => {
    const aTime = typeof a.startTime === "string" 
      ? new Date(a.startTime).getTime()
      : (a.startTime instanceof Date ? a.startTime.getTime() : 0);
    const bTime = typeof b.startTime === "string"
      ? new Date(b.startTime).getTime()
      : (b.startTime instanceof Date ? b.startTime.getTime() : 0);
    return aTime - bTime;
  });

  return events;
}

