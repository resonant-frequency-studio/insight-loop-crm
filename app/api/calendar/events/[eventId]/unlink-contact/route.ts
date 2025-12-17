import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";
import { FieldValue } from "firebase-admin/firestore";
import { CalendarEvent } from "@/types/firestore";

/**
 * POST /api/calendar/events/[eventId]/unlink-contact
 * Unlink a calendar event from its contact
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const userId = await getUserId();
    const { eventId } = await params;

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

    // Update event to unlink contact
    await eventRef.update({
      matchedContactId: null,
      matchOverriddenByUser: true,
      contactSnapshot: null,
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
      context: "Unlinking calendar event from contact",
      tags: { component: "calendar-unlink-contact-api" },
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

