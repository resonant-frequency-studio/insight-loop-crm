import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";
import { convertEventToTouchpoint } from "@/lib/calendar/event-to-touchpoint";

/**
 * POST /api/calendar/events/[eventId]/convert-to-touchpoint
 * Convert a calendar event to a touchpoint
 * Body: {
 *   contactId: string
 *   markAsFollowUp?: boolean (optional, defaults to false)
 * }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const userId = await getUserId();
    const { eventId } = await params;
    const body = await req.json();
    const { contactId, markAsFollowUp } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required" },
        { status: 400 }
      );
    }

    // Convert event to touchpoint
    const result = await convertEventToTouchpoint({
      db: adminDb,
      userId,
      eventId,
      contactId,
      markAsFollowUp: markAsFollowUp || false,
    });

    if (!result.success) {
      return NextResponse.json(
        { 
          ok: false,
          error: result.error || "Failed to convert event to touchpoint",
        },
        { status: 500 }
      );
    }

    // Fetch the updated contact
    const contactDoc = await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .get();

    if (!contactDoc.exists) {
      return NextResponse.json(
        { 
          ok: false,
          error: "Contact not found after conversion",
        },
        { status: 500 }
      );
    }

    const contact = contactDoc.data();

    return NextResponse.json({
      ok: true,
      contact: {
        ...contact,
        contactId: contactDoc.id,
      },
      touchpointDate: result.touchpointDate?.toISOString(),
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    reportException(err, {
      context: "Converting calendar event to touchpoint",
      tags: { component: "event-convert-api" },
      extra: { originalError: errorMessage },
    });
    
    const friendlyError = toUserFriendlyError(err);
    
    return NextResponse.json(
      { 
        error: friendlyError,
        ok: false,
      },
      { status: 500 }
    );
  }
}

