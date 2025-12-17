import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";
import { convertTouchpointToEvent } from "@/lib/calendar/touchpoint-to-event";

/**
 * POST /api/touchpoints/convert-to-event
 * Convert a touchpoint to a Google Calendar event
 * Body: {
 *   contactId: string
 *   touchpointDate?: string (ISO date string, optional - uses contact's nextTouchpointDate if not provided)
 *   message?: string (optional - uses contact's nextTouchpointMessage if not provided)
 *   calendarId?: string (optional, defaults to "primary")
 *   timeZone?: string (optional, defaults to "UTC")
 * }
 */
export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { contactId, touchpointDate, message, calendarId, timeZone } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required" },
        { status: 400 }
      );
    }

    // Get contact to retrieve touchpoint details if not provided
    const contactDoc = await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .get();

    if (!contactDoc.exists) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    const contact = contactDoc.data();
    if (!contact) {
      return NextResponse.json(
        { error: "Contact data not found" },
        { status: 404 }
      );
    }

    // Use provided touchpointDate or contact's nextTouchpointDate
    let eventDate: Date;
    if (touchpointDate) {
      eventDate = new Date(touchpointDate);
      if (isNaN(eventDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid touchpointDate format. Use ISO 8601 format." },
          { status: 400 }
        );
      }
    } else if (contact.nextTouchpointDate) {
      // Parse contact's nextTouchpointDate
      const contactDate = contact.nextTouchpointDate;
      if (contactDate instanceof Date) {
        eventDate = contactDate;
      } else if (contactDate && typeof contactDate === "object" && "toDate" in contactDate) {
        eventDate = (contactDate as { toDate: () => Date }).toDate();
      } else if (typeof contactDate === "string") {
        eventDate = new Date(contactDate);
      } else {
        return NextResponse.json(
          { error: "No touchpoint date available. Please provide touchpointDate or set nextTouchpointDate on the contact." },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "No touchpoint date available. Please provide touchpointDate or set nextTouchpointDate on the contact." },
        { status: 400 }
      );
    }

    // Use provided message or contact's nextTouchpointMessage
    const eventMessage = message || contact.nextTouchpointMessage || undefined;

    // Convert touchpoint to event
    const result = await convertTouchpointToEvent({
      db: adminDb,
      userId,
      contactId,
      touchpointDate: eventDate,
      message: eventMessage,
      calendarId,
      timeZone,
    });

    if (!result.success) {
      return NextResponse.json(
        { 
          ok: false,
          error: result.error || "Failed to convert touchpoint to event",
        },
        { status: 500 }
      );
    }

    // Fetch the created event
    const eventDoc = await adminDb
      .collection("users")
      .doc(userId)
      .collection("calendarEvents")
      .doc(result.eventId)
      .get();

    if (!eventDoc.exists) {
      return NextResponse.json(
        { 
          ok: false,
          error: "Event created but not found in cache",
        },
        { status: 500 }
      );
    }

    const event = eventDoc.data();

    return NextResponse.json({
      ok: true,
      event: {
        ...event,
        eventId: eventDoc.id,
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    reportException(err, {
      context: "Converting touchpoint to calendar event",
      tags: { component: "touchpoint-convert-api" },
      extra: { originalError: errorMessage },
    });
    
    const friendlyError = toUserFriendlyError(err);
    
    // Check for auth errors
    if (errorMessage.includes("Calendar access") || errorMessage.includes("permission")) {
      return NextResponse.json(
        { 
          error: friendlyError,
          ok: false,
          requiresReauth: true,
        },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { 
        error: friendlyError,
        ok: false,
      },
      { status: 500 }
    );
  }
}

