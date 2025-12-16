import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";
import { FieldValue } from "firebase-admin/firestore";
import { getContactForUser } from "@/lib/contacts-server";
import { CalendarEvent } from "@/types/firestore";

/**
 * POST /api/calendar/events/[eventId]/link-contact
 * Manually link a calendar event to a contact
 * Body: { contactId: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const userId = await getUserId();
    const { eventId } = await params;
    const body = await req.json();
    const { contactId } = body;

    if (!contactId || typeof contactId !== "string") {
      return NextResponse.json(
        { error: "contactId is required and must be a string" },
        { status: 400 }
      );
    }

    // Verify event exists
    const eventRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("calendarEvents")
      .doc(eventId);

    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Verify contact exists
    const contact = await getContactForUser(userId, contactId);
    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Create contact snapshot
    const contactSnapshot = {
      name: `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.primaryEmail,
      segment: contact.segment || null,
      tags: contact.tags || [],
      primaryEmail: contact.primaryEmail,
      engagementScore: contact.engagementScore || null,
      snapshotUpdatedAt: FieldValue.serverTimestamp(),
    };

    // Update event with linked contact
    await eventRef.update({
      matchedContactId: contactId,
      matchMethod: "manual",
      matchConfidence: "high", // Manual matches are always high confidence
      matchOverriddenByUser: true,
      contactSnapshot: contactSnapshot,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Get updated event
    const updatedEventDoc = await eventRef.get();
    const updatedEvent = updatedEventDoc.data() as CalendarEvent;

    return NextResponse.json({
      ok: true,
      event: {
        ...updatedEvent,
        eventId: updatedEventDoc.id,
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    reportException(err, {
      context: "Linking calendar event to contact",
      tags: { component: "calendar-link-contact-api" },
      extra: { originalError: errorMessage },
    });
    
    const friendlyError = toUserFriendlyError(err);
    
    return NextResponse.json(
      { 
        ok: false,
        error: friendlyError,
      },
      { status: 500 }
    );
  }
}

