import { Firestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { createGoogleEvent } from "./write-calendar-event";
import { reportException } from "@/lib/error-reporting";
import { CalendarEvent } from "@/types/firestore";

export interface ConvertTouchpointToEventOptions {
  db: Firestore;
  userId: string;
  contactId: string;
  touchpointDate: Date;
  message?: string;
  calendarId?: string;
  timeZone?: string;
}

export interface ConvertTouchpointToEventResult {
  eventId: string;
  googleEventId: string;
  success: boolean;
  error?: string;
}

/**
 * Convert a touchpoint to a Google Calendar event
 * Creates the event, links it to the touchpoint, and updates both documents
 */
export async function convertTouchpointToEvent(
  options: ConvertTouchpointToEventOptions
): Promise<ConvertTouchpointToEventResult> {
  const { db, userId, contactId, touchpointDate, message, calendarId, timeZone } = options;

  try {
    // Get contact to verify it exists and get contact details
    const contactDoc = await db
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .get();

    if (!contactDoc.exists) {
      return {
        eventId: "",
        googleEventId: "",
        success: false,
        error: "Contact not found",
      };
    }

    const contact = contactDoc.data();
    if (!contact) {
      return {
        eventId: "",
        googleEventId: "",
        success: false,
        error: "Contact data not found",
      };
    }

    // Check if already linked to an event
    if (contact.linkedGoogleEventId && contact.linkStatus === "linked") {
      return {
        eventId: "",
        googleEventId: "",
        success: false,
        error: "Touchpoint is already linked to a calendar event",
      };
    }

    // Create event title from contact name and message
    const contactName = [contact.firstName, contact.lastName]
      .filter(Boolean)
      .join(" ") || contact.primaryEmail;
    const eventTitle = message 
      ? `${contactName} - ${message}`
      : `Follow-up: ${contactName}`;

    // Default to 1 hour duration if no end time specified
    const startTime = new Date(touchpointDate);
    const endTime = new Date(touchpointDate);
    endTime.setHours(endTime.getHours() + 1);

    // Create Google Calendar event
    const googleEvent = await createGoogleEvent({
      userId,
      calendarId: calendarId || "primary",
      title: eventTitle,
      description: message || `Follow-up meeting with ${contactName}`,
      startTime,
      endTime,
      timeZone: timeZone || "UTC",
    });

    // Store event in Firestore cache
    const eventsCollection = db
      .collection("users")
      .doc(userId)
      .collection("calendarEvents");

    const eventData: Partial<CalendarEvent> = {
      googleEventId: googleEvent.id,
      userId,
      title: googleEvent.summary || eventTitle,
      description: googleEvent.description || null,
      location: googleEvent.location || null,
      attendees: googleEvent.attendees?.map((a) => {
        const attendee: { email: string; displayName?: string } = {
          email: a.email,
        };
        if (a.displayName) {
          attendee.displayName = a.displayName;
        }
        return attendee;
      }) || [],
      startTime: Timestamp.fromDate(new Date(googleEvent.start.dateTime || googleEvent.start.date!)),
      endTime: Timestamp.fromDate(new Date(googleEvent.end.dateTime || googleEvent.end.date!)),
      lastSyncedAt: FieldValue.serverTimestamp(),
      etag: googleEvent.etag,
      googleUpdated: googleEvent.updated 
        ? Timestamp.fromDate(new Date(googleEvent.updated))
        : FieldValue.serverTimestamp(),
      sourceOfTruth: "crm_touchpoint",
      isDirty: false,
      matchedContactId: contactId,
      matchConfidence: "high",
      matchMethod: "manual",
      matchOverriddenByUser: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Use googleEvent.id as document ID for consistency
    await eventsCollection.doc(googleEvent.id).set(eventData);

    // Update contact with link to event
    await contactDoc.ref.update({
      linkedGoogleEventId: googleEvent.id,
      linkedGoogleCalendarId: calendarId || "primary",
      linkStatus: "linked",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      eventId: googleEvent.id,
      googleEventId: googleEvent.id,
      success: true,
    };
  } catch (error) {
    reportException(error, {
      context: "Converting touchpoint to calendar event",
      tags: { component: "touchpoint-to-event", userId, contactId },
    });

    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      eventId: "",
      googleEventId: "",
      success: false,
      error: errorMessage,
    };
  }
}

