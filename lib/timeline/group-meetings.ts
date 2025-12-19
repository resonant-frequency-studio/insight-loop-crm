import { TimelineItem } from "@/types/firestore";

/**
 * Normalizes a meeting title for grouping purposes
 */
function normalizeTitle(title: string): string {
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
 */
function normalizeAttendees(attendees?: Array<{ email?: string }>): string {
  if (!attendees || attendees.length === 0) return "";
  return attendees
    .map((a) => a.email?.toLowerCase().trim() || "")
    .filter(Boolean)
    .sort()
    .join(",");
}

/**
 * Creates a grouping key for a meeting
 * Note: All meetings in a contact's timeline are already filtered by contactId,
 * so we don't need to include it in the grouping key
 */
function createGroupKey(
  title: string,
  attendees?: Array<{ email?: string }>
): string {
  const normalizedTitle = normalizeTitle(title);
  const normalizedAttendees = normalizeAttendees(attendees);
  
  // Group by: normalized title + stable attendee set
  return `${normalizedTitle}|${normalizedAttendees}`;
}

export interface MeetingSeries {
  seriesId: string;
  title: string;
  matchedContactId?: string | null;
  attendeeCount: number;
  occurrenceCount: number;
  lastOccurrenceDate: Date;
  nextOccurrenceDate?: Date;
  items: TimelineItem[];
}

/**
 * Groups recurring meetings into series
 */
export function groupMeetingsIntoSeries(
  meetings: TimelineItem[]
): Array<MeetingSeries | TimelineItem> {
  // Early return if no meetings
  if (meetings.length === 0) {
    return [];
  }

  // Filter to only calendar events
  const meetingItems = meetings.filter(
    (item) => item.type === "calendar_event"
  ) as TimelineItem[];

  // Early return if no meeting items - return non-meeting items as-is
  if (meetingItems.length === 0) {
    return meetings.filter((item) => item.type !== "calendar_event");
  }

  // Group meetings by their grouping key
  const groups = new Map<string, TimelineItem[]>();

  for (const meeting of meetingItems) {
    const groupKey = createGroupKey(meeting.title, meeting.attendees);

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(meeting);
  }

  const result: Array<MeetingSeries | TimelineItem> = [];

  // Process each group
  for (const [groupKey, items] of groups.entries()) {
    // If only one meeting, don't group it
    if (items.length === 1) {
      result.push(items[0]);
      continue;
    }

    // Sort items by timestamp (newest first)
    items.sort((a, b) => {
      const getTime = (timestamp: unknown): number => {
        if (timestamp instanceof Date) return timestamp.getTime();
        if (typeof timestamp === "string") return new Date(timestamp).getTime();
        if (timestamp && typeof timestamp === "object") {
          if ("toDate" in timestamp) {
            return (timestamp as { toDate: () => Date }).toDate().getTime();
          }
          if ("seconds" in timestamp) {
            const ts = timestamp as { seconds: number; nanoseconds?: number };
            return ts.seconds * 1000;
          }
        }
        return 0;
      };
      return getTime(b.timestamp) - getTime(a.timestamp);
    });

    // Find last and next occurrence
    const now = new Date();
    let lastOccurrenceDate = new Date(0);
    let nextOccurrenceDate: Date | undefined;

    const getDate = (timestamp: unknown): Date => {
      if (timestamp instanceof Date) return timestamp;
      if (typeof timestamp === "string") return new Date(timestamp);
      if (timestamp && typeof timestamp === "object") {
        if ("toDate" in timestamp) {
          return (timestamp as { toDate: () => Date }).toDate();
        }
        if ("seconds" in timestamp) {
          const ts = timestamp as { seconds: number; nanoseconds?: number };
          return new Date(ts.seconds * 1000);
        }
      }
      return new Date();
    };

    for (const item of items) {
      const itemDate = getDate(item.timestamp);

      if (itemDate > lastOccurrenceDate) {
        lastOccurrenceDate = itemDate;
      }

      if (itemDate > now && (!nextOccurrenceDate || itemDate < nextOccurrenceDate)) {
        nextOccurrenceDate = itemDate;
      }
    }

    // Get unique attendees count
    const allAttendees = new Set<string>();
    items.forEach((item) => {
      item.attendees?.forEach((a) => {
        if (a.email) allAttendees.add(a.email.toLowerCase());
      });
    });

    // Use the most recent meeting's title as the series title
    const seriesTitle = items[0].title;

    const series: MeetingSeries = {
      seriesId: groupKey,
      title: seriesTitle,
      matchedContactId: null, // All meetings in timeline are for the same contact
      attendeeCount: allAttendees.size,
      occurrenceCount: items.length,
      lastOccurrenceDate,
      nextOccurrenceDate,
      items,
    };

    result.push(series);
  }

  // Add non-meeting items as-is
  const nonMeetingItems = meetings.filter(
    (item) => item.type !== "calendar_event"
  );
  result.push(...nonMeetingItems);

  // Sort all items by timestamp (newest first)
  result.sort((a, b) => {
    const getDate = (item: MeetingSeries | TimelineItem): Date => {
      if ("items" in item) {
        // It's a series - use last occurrence date
        return item.lastOccurrenceDate;
      }
      // It's a timeline item
      const timestamp = item.timestamp;
      if (timestamp instanceof Date) return timestamp;
      if (typeof timestamp === "string") return new Date(timestamp);
      if (timestamp && typeof timestamp === "object") {
        if ("toDate" in timestamp) {
          return (timestamp as { toDate: () => Date }).toDate();
        }
        if ("seconds" in timestamp) {
          const ts = timestamp as { seconds: number; nanoseconds?: number };
          return new Date(ts.seconds * 1000);
        }
      }
      return new Date(0);
    };

    return getDate(b).getTime() - getDate(a).getTime();
  });

  return result;
}

