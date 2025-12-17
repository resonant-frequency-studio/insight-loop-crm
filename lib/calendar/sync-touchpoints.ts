import { Firestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { CalendarEvent, Contact } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

/**
 * Sync a contact's touchpoint to a calendar event in Firestore
 * Creates or updates a calendar event when nextTouchpointDate is set
 * Deletes the event when nextTouchpointDate is cleared
 * 
 * @param db Firestore instance
 * @param userId User ID
 * @param contact Contact with touchpoint information
 * @returns Calendar event ID if created/updated, null if deleted
 */
export async function syncTouchpointToCalendar(
  db: Firestore,
  userId: string,
  contact: Contact & { contactId: string }
): Promise<string | null> {
  try {
    const eventsCollection = db
      .collection("users")
      .doc(userId)
      .collection("calendarEvents");

    // Find existing touchpoint event for this contact
    const existingEventQuery = await eventsCollection
      .where("sourceOfTruth", "==", "crm_touchpoint")
      .where("matchedContactId", "==", contact.contactId)
      .limit(1)
      .get();

    const existingEventDoc = existingEventQuery.docs[0];

    // If no touchpoint date, delete existing event if it exists
    if (!contact.nextTouchpointDate) {
      if (existingEventDoc) {
        await existingEventDoc.ref.delete();
      }
      return null;
    }

    // Parse touchpoint date
    let touchpointDate: Date;
    if (contact.nextTouchpointDate instanceof Date) {
      touchpointDate = contact.nextTouchpointDate;
    } else if (contact.nextTouchpointDate && typeof contact.nextTouchpointDate === "object" && "toDate" in contact.nextTouchpointDate) {
      touchpointDate = (contact.nextTouchpointDate as { toDate: () => Date }).toDate();
    } else if (typeof contact.nextTouchpointDate === "string") {
      touchpointDate = new Date(contact.nextTouchpointDate);
    } else {
      // Invalid date, skip
      return null;
    }

    // Validate that date is valid
    if (isNaN(touchpointDate.getTime())) {
      // Invalid date, skip
      return null;
    }

    // Create event title
    const contactName = [contact.firstName, contact.lastName]
      .filter(Boolean)
      .join(" ") || contact.primaryEmail;
    const eventTitle = `Follow up: ${contactName}`;

    // Create event data
    const startTime = Timestamp.fromDate(new Date(touchpointDate.getFullYear(), touchpointDate.getMonth(), touchpointDate.getDate(), 9, 0, 0)); // 9 AM local time
    const endTime = Timestamp.fromDate(new Date(touchpointDate.getFullYear(), touchpointDate.getMonth(), touchpointDate.getDate(), 10, 0, 0)); // 10 AM local time (1 hour duration)

    const eventData: Partial<CalendarEvent> = {
      userId,
      title: eventTitle,
      description: contact.nextTouchpointMessage || null,
      startTime,
      endTime,
      sourceOfTruth: "crm_touchpoint",
      matchedContactId: contact.contactId,
      matchMethod: "manual",
      matchConfidence: "high",
      matchOverriddenByUser: false,
      contactSnapshot: {
        name: contactName,
        segment: contact.segment || null,
        tags: contact.tags || [],
        primaryEmail: contact.primaryEmail,
        engagementScore: contact.engagementScore || null,
        snapshotUpdatedAt: FieldValue.serverTimestamp(),
      },
      isDirty: false, // Touchpoint events are source of truth in CRM
      googleUpdated: null, // Not synced from Google
      lastSyncedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // If event exists, update it; otherwise create new
    if (existingEventDoc) {
      await existingEventDoc.ref.update({
        ...eventData,
        createdAt: existingEventDoc.data().createdAt, // Preserve original creation time
      });
      return existingEventDoc.id;
    } else {
      const newEventRef = await eventsCollection.add({
        ...eventData,
        googleEventId: null, // Touchpoint events don't have Google event IDs
        createdAt: FieldValue.serverTimestamp(),
      });
      return newEventRef.id;
    }
  } catch (error) {
    reportException(error, {
      context: "Syncing touchpoint to calendar",
      tags: { component: "sync-touchpoints", userId, contactId: contact.contactId },
    });
    throw error;
  }
}

/**
 * Update calendar event when touchpoint status changes
 * Marks the event as completed/cancelled based on touchpoint status
 * 
 * @param db Firestore instance
 * @param userId User ID
 * @param contactId Contact ID
 * @param status Touchpoint status
 */
export async function syncTouchpointStatusToCalendar(
  db: Firestore,
  userId: string,
  contactId: string,
  status: "pending" | "completed" | "cancelled" | null
): Promise<void> {
  try {
    const eventsCollection = db
      .collection("users")
      .doc(userId)
      .collection("calendarEvents");

    // Find touchpoint event for this contact
    const existingEventQuery = await eventsCollection
      .where("sourceOfTruth", "==", "crm_touchpoint")
      .where("matchedContactId", "==", contactId)
      .limit(1)
      .get();

    if (existingEventQuery.empty) {
      // No touchpoint event found, nothing to update
      return;
    }

    const eventDoc = existingEventQuery.docs[0];
    const eventData = eventDoc.data() as CalendarEvent;

    // If status is cancelled or null, delete the event
    if (status === "cancelled" || status === null) {
      await eventDoc.ref.delete();
      return;
    }

    // Update event title to reflect status
    let title = eventData.title || "";
    if (status === "completed") {
      // Add completed indicator to title
      if (!title.includes("✓")) {
        title = `✓ ${title}`;
      }
    } else {
      // Remove completed indicator if present
      title = title.replace(/^✓\s*/, "");
    }

    await eventDoc.ref.update({
      title,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    reportException(error, {
      context: "Syncing touchpoint status to calendar",
      tags: { component: "sync-touchpoints", userId, contactId },
    });
    // Don't throw - this is a background sync, we don't want to fail the main operation
  }
}

