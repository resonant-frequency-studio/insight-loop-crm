import { Firestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { reportException } from "@/lib/error-reporting";
import { CalendarEvent } from "@/types/firestore";

export interface ConvertEventToTouchpointOptions {
  db: Firestore;
  userId: string;
  eventId: string;
  contactId: string;
  markAsFollowUp?: boolean; // If true, marks touchpoint as needing follow-up
}

export interface ConvertEventToTouchpointResult {
  success: boolean;
  touchpointDate?: Date;
  error?: string;
}

/**
 * Convert a calendar event to a touchpoint
 * Creates a touchpoint from the event and links them
 * Does NOT delete the Google Calendar event
 */
export async function convertEventToTouchpoint(
  options: ConvertEventToTouchpointOptions
): Promise<ConvertEventToTouchpointResult> {
  const { db, userId, eventId, contactId, markAsFollowUp = false } = options;

  try {
    // Get event to extract details
    const eventDoc = await db
      .collection("users")
      .doc(userId)
      .collection("calendarEvents")
      .doc(eventId)
      .get();

    if (!eventDoc.exists) {
      return {
        success: false,
        error: "Event not found",
      };
    }

    const event = eventDoc.data() as CalendarEvent;
    if (!event) {
      return {
        success: false,
        error: "Event data not found",
      };
    }

    // Get contact to verify it exists
    const contactDoc = await db
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .get();

    if (!contactDoc.exists) {
      return {
        success: false,
        error: "Contact not found",
      };
    }

    const contact = contactDoc.data();
    if (!contact) {
      return {
        success: false,
        error: "Contact data not found",
      };
    }

    // Check if already linked
    if (contact.linkedGoogleEventId === eventId && contact.linkStatus === "linked") {
      return {
        success: false,
        error: "Event is already linked to this contact's touchpoint",
      };
    }

    // Extract event start time as touchpoint date
    let touchpointDate: Date;
    if (event.startTime instanceof Timestamp) {
      touchpointDate = event.startTime.toDate();
    } else if (event.startTime instanceof Date) {
      touchpointDate = event.startTime;
    } else if (typeof event.startTime === "string") {
      touchpointDate = new Date(event.startTime);
    } else if (event.startTime && typeof event.startTime === "object" && "toDate" in event.startTime) {
      touchpointDate = (event.startTime as { toDate: () => Date }).toDate();
    } else {
      return {
        success: false,
        error: "Invalid event start time",
      };
    }

    // Extract message from event description or title
    const touchpointMessage = event.description || 
      (event.title.includes(" - ") ? event.title.split(" - ")[1] : null) ||
      null;

    // Update contact with touchpoint and link to event
    const contactUpdates: Record<string, unknown> = {
      nextTouchpointDate: Timestamp.fromDate(touchpointDate),
      touchpointStatus: "pending",
      touchpointStatusUpdatedAt: FieldValue.serverTimestamp(),
      linkedGoogleEventId: eventId,
      linkedGoogleCalendarId: "primary", // Default, could be extracted from event if stored
      linkStatus: "linked",
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (touchpointMessage) {
      contactUpdates.nextTouchpointMessage = touchpointMessage;
    }

    // If markAsFollowUp, ensure it's in the future or mark as needing attention
    if (markAsFollowUp && touchpointDate <= new Date()) {
      // Event is in the past, mark as needing follow-up
      contactUpdates.touchpointStatus = "pending";
      contactUpdates.touchpointStatusReason = "Follow-up needed after meeting";
    }

    await contactDoc.ref.update(contactUpdates);

    // Update event to link to contact (if not already linked)
    if (event.matchedContactId !== contactId) {
      await eventDoc.ref.update({
        matchedContactId: contactId,
        matchConfidence: "high",
        matchMethod: "manual",
        matchOverriddenByUser: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      touchpointDate,
    };
  } catch (error) {
    reportException(error, {
      context: "Converting calendar event to touchpoint",
      tags: { component: "event-to-touchpoint", userId, eventId, contactId },
    });

    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

