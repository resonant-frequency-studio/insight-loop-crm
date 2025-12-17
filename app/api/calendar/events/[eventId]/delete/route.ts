import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";
import { deleteGoogleEvent } from "@/lib/calendar/write-calendar-event";

/**
 * DELETE /api/calendar/events/[eventId]/delete
 * Delete a calendar event from Google Calendar and Firestore cache
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const userId = await getUserId();
    const { eventId } = await params;

    // Get cached event to retrieve etag and check if it exists
    const eventsCollection = adminDb
      .collection("users")
      .doc(userId)
      .collection("calendarEvents");

    const eventDoc = await eventsCollection.doc(eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const cachedEvent = eventDoc.data() as { googleEventId?: string; etag?: string };
    const googleEventId = cachedEvent?.googleEventId || eventId;
    const etag = cachedEvent?.etag;

      // Delete from Google Calendar
    try {
      await deleteGoogleEvent({
        userId,
        calendarId: undefined, // Use default 'primary'
        googleEventId: googleEventId,
        etag, // Optional - for conflict detection
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // If event is already deleted in Google (404), still remove from cache
      if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        // Continue to remove from cache
      } 
      // If there's a conflict (409/412), check if event still exists
      // If it was deleted externally, the conflict is because etag doesn't match deleted event
      else if (errorMessage.includes("409") || errorMessage.includes("412") || errorMessage.includes("modified elsewhere")) {
        // Try to get the event to see if it still exists
        try {
          const { GoogleCalendarClient } = await import("@/lib/calendar/google-calendar-client");
          const { getCalendarAccessToken } = await import("@/lib/calendar/get-access-token");
          const accessToken = await getCalendarAccessToken(userId, false);
          const client = new GoogleCalendarClient(accessToken);
          
          // Try to fetch the event - if it doesn't exist, it was deleted
          await client.getEvent("primary", googleEventId);
          
          // If we get here, the event still exists but was modified - this is a real conflict
          throw error;
        } catch (checkError) {
          const checkErrorMessage = checkError instanceof Error ? checkError.message : String(checkError);
          
          // If the check also fails with 404, the event was deleted externally
          if (checkErrorMessage.includes("404") || checkErrorMessage.includes("not found")) {
            // Event was deleted externally, just remove from cache
            // Continue to delete from Firestore below
          } else {
            // Some other error during check, re-throw original conflict error
            throw error;
          }
        }
      } else {
        // Re-throw other errors
        throw error;
      }
    }

    // Remove from Firestore cache
    await eventsCollection.doc(eventId).delete();

    // TODO: If linked to touchpoint, update touchpoint status
    // This will be handled in PR 5

    return NextResponse.json({
      ok: true,
      message: "Event deleted successfully",
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    reportException(err, {
      context: "Deleting calendar event",
      tags: { component: "calendar-delete-api" },
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

