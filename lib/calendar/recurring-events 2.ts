import { CalendarEvent } from "@/types/firestore";
import { Firestore } from "firebase-admin/firestore";

/**
 * Normalizes a meeting title for grouping purposes
 * (Exported version of the function from group-meetings.ts)
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .replace(/\b(weekly|monthly|daily|recurring|meeting|call|standup)\b/gi, "") // Remove common suffixes
    .trim();
}

/**
 * Normalizes attendee emails for comparison
 * (Exported version of the function from group-meetings.ts)
 */
export function normalizeAttendees(attendees?: Array<{ email?: string }>): string {
  if (!attendees || attendees.length === 0) return "";
  return attendees
    .map((a) => a.email?.toLowerCase().trim() || "")
    .filter(Boolean)
    .sort()
    .join(",");
}

/**
 * Creates a grouping key for a meeting
 * Events with the same group key are considered part of the same recurring series
 */
export function createRecurringEventGroupKey(
  title: string,
  attendees?: Array<{ email?: string }>
): string {
  const normalizedTitle = normalizeTitle(title);
  const normalizedAttendees = normalizeAttendees(attendees);
  
  // Group by: normalized title + stable attendee set
  return `${normalizedTitle}|${normalizedAttendees}`;
}

/**
 * Get the recurring event group key for a calendar event
 */
export function getRecurringEventGroupKey(event: CalendarEvent): string {
  return createRecurringEventGroupKey(event.title, event.attendees);
}

/**
 * Find all event IDs that are part of the same recurring series as the given event
 */
export async function findRecurringEventIds(
  db: Firestore,
  userId: string,
  event: CalendarEvent,
  excludeEventId?: string
): Promise<string[]> {
  const recurringGroupKey = getRecurringEventGroupKey(event);
  const eventsCollection = db
    .collection("users")
    .doc(userId)
    .collection("calendarEvents");
  
  const allEventsSnapshot = await eventsCollection.get();
  const recurringEventIds: string[] = [];
  
  for (const doc of allEventsSnapshot.docs) {
    // Skip the excluded event (usually the current event being processed)
    if (excludeEventId && doc.id === excludeEventId) {
      continue;
    }
    
    const eventData = doc.data() as CalendarEvent;
    const eventGroupKey = getRecurringEventGroupKey(eventData);
    
    if (eventGroupKey === recurringGroupKey) {
      recurringEventIds.push(doc.id);
    }
  }
  
  return recurringEventIds;
}

