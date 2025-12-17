import { Firestore, Timestamp, Query } from "firebase-admin/firestore";
import { TimelineItem, CalendarEvent, ActionItem, Thread, Contact } from "@/types/firestore";

interface GetContactTimelineOptions {
  limit?: number;
  before?: Date; // Cursor for pagination
}

/**
 * Get unified timeline for a contact, merging calendar events, touchpoints, action items, and emails
 */
export async function getContactTimeline(
  db: Firestore,
  userId: string,
  contactId: string,
  options: GetContactTimelineOptions = {}
): Promise<TimelineItem[]> {
  const { limit = 50, before } = options;
  const timelineItems: TimelineItem[] = [];

  // 1. Fetch calendar events for this contact
  const eventsCollection = db
    .collection("users")
    .doc(userId)
    .collection("calendarEvents");

  let eventsQuery: Query = eventsCollection
    .where("matchedContactId", "==", contactId)
    .orderBy("startTime", "desc");

  if (before) {
    const beforeTimestamp = Timestamp.fromDate(before);
    eventsQuery = eventsQuery.where("startTime", "<", beforeTimestamp);
  }

  const eventsSnapshot = await eventsQuery.limit(limit).get();
  
  for (const doc of eventsSnapshot.docs) {
    const event = doc.data() as CalendarEvent;
    const startTime = event.startTime instanceof Timestamp
      ? event.startTime
      : typeof event.startTime === "string"
      ? Timestamp.fromDate(new Date(event.startTime))
      : null;

    if (!startTime) continue;

    timelineItems.push({
      id: doc.id,
      type: "calendar_event",
      timestamp: startTime,
      title: event.title || "Untitled Event",
      description: event.description,
      eventId: doc.id,
      location: event.location,
      attendees: event.attendees,
    });
  }

  // 2. Fetch touchpoints (from contact's nextTouchpointDate and historical touchpoints)
  // For now, we'll use the contact's nextTouchpointDate as the primary touchpoint
  // In the future, we might store historical touchpoints separately
  const contactDoc = await db
    .collection("users")
    .doc(userId)
    .collection("contacts")
    .doc(contactId)
    .get();

  if (contactDoc.exists) {
    const contact = contactDoc.data() as Contact;
    
    if (contact.nextTouchpointDate) {
      const touchpointDate = contact.nextTouchpointDate instanceof Timestamp
        ? contact.nextTouchpointDate
        : typeof contact.nextTouchpointDate === "string"
        ? Timestamp.fromDate(new Date(contact.nextTouchpointDate))
        : null;

      if (touchpointDate && (!before || touchpointDate.toDate() < before)) {
        timelineItems.push({
          id: `touchpoint-${contactId}`,
          type: "touchpoint",
          timestamp: touchpointDate,
          title: "Next Touchpoint",
          description: contact.nextTouchpointMessage,
          touchpointId: contactId,
        });
      }
    }
  }

  // 3. Fetch action items for this contact
  const actionItemsCollection = db
    .collection("users")
    .doc(userId)
    .collection("contacts")
    .doc(contactId)
    .collection("actionItems");

  let actionItemsQuery: Query = actionItemsCollection.orderBy("createdAt", "desc");

  if (before) {
    const beforeTimestamp = Timestamp.fromDate(before);
    actionItemsQuery = actionItemsQuery.where("createdAt", "<", beforeTimestamp);
  }

  const actionItemsSnapshot = await actionItemsQuery.limit(limit).get();

  for (const doc of actionItemsSnapshot.docs) {
    const actionItem = doc.data() as ActionItem;
    const createdAt = actionItem.createdAt instanceof Timestamp
      ? actionItem.createdAt
      : typeof actionItem.createdAt === "string"
      ? Timestamp.fromDate(new Date(actionItem.createdAt))
      : null;

    if (!createdAt) continue;

    timelineItems.push({
      id: doc.id,
      type: "action_item",
      timestamp: createdAt,
      title: actionItem.text,
      description: actionItem.status === "completed" ? "Completed" : "Pending",
      actionItemId: doc.id,
      status: actionItem.status,
    });
  }

  // 4. Fetch email threads for this contact
  // Threads can have contactId (singular) or contactIds (plural array)
  const threadsCollection = db
    .collection("users")
    .doc(userId)
    .collection("threads");

  // Query by contactId field (singular)
  let threadsQuery: Query = threadsCollection
    .where("contactId", "==", contactId)
    .orderBy("lastMessageAt", "desc");

  if (before) {
    // Convert before date to ISO string for comparison
    const beforeIso = before.toISOString();
    threadsQuery = threadsQuery.where("lastMessageAt", "<", beforeIso);
  }

  try {
    const threadsSnapshot = await threadsQuery.limit(limit).get();

    for (const doc of threadsSnapshot.docs) {
      const thread = doc.data() as Thread;
      const lastMessageAt = thread.lastMessageAt instanceof Timestamp
        ? thread.lastMessageAt
        : typeof thread.lastMessageAt === "string"
        ? Timestamp.fromDate(new Date(thread.lastMessageAt))
        : null;

      if (!lastMessageAt) continue;

      timelineItems.push({
        id: doc.id,
        type: "email",
        timestamp: lastMessageAt,
        title: thread.subject || "No Subject",
        description: thread.snippet,
        threadId: doc.id,
      });
    }
  } catch {
    // If query fails (e.g., missing index), try alternative query
    // Query by contactIds array (if it exists)
    try {
      const allThreadsSnapshot = await threadsCollection.get();
      const filteredThreads = allThreadsSnapshot.docs.filter((doc) => {
        const thread = doc.data() as Thread;
        const threadWithContactId = thread as Thread & { contactId?: string };
        return (
          thread.contactIds?.includes(contactId) ||
          threadWithContactId.contactId === contactId
        );
      });

      for (const doc of filteredThreads) {
        const thread = doc.data() as Thread;
        const lastMessageAt = thread.lastMessageAt instanceof Timestamp
          ? thread.lastMessageAt
          : typeof thread.lastMessageAt === "string"
          ? Timestamp.fromDate(new Date(thread.lastMessageAt))
          : null;

        if (!lastMessageAt) continue;
        if (before && lastMessageAt.toDate() >= before) continue;

        timelineItems.push({
          id: doc.id,
          type: "email",
          timestamp: lastMessageAt,
          title: thread.subject || "No Subject",
          description: thread.snippet,
          threadId: doc.id,
        });
      }
    } catch (fallbackError) {
      // If both queries fail, log and continue without email items
      console.error("Failed to fetch email threads for timeline:", fallbackError);
    }
  }

  // Sort all items by timestamp (newest first)
  timelineItems.sort((a, b) => {
    const aTime = a.timestamp instanceof Timestamp
      ? a.timestamp.toDate().getTime()
      : typeof a.timestamp === "string"
      ? new Date(a.timestamp).getTime()
      : 0;
    const bTime = b.timestamp instanceof Timestamp
      ? b.timestamp.toDate().getTime()
      : typeof b.timestamp === "string"
      ? new Date(b.timestamp).getTime()
      : 0;
    return bTime - aTime; // Descending order (newest first)
  });

  // Apply limit after sorting
  return timelineItems.slice(0, limit);
}

