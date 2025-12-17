import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getCalendarAccessToken } from "@/lib/calendar/get-access-token";
import { GoogleCalendarClient } from "@/lib/calendar/google-calendar-client";
import { CalendarEvent } from "@/types/firestore";

/**
 * GET /api/calendar/events/[eventId]/refresh
 * Refresh a single event from Google Calendar
 * Fetches the latest version from Google and updates the Firestore cache
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const userId = await getUserId();
    const { eventId } = await params;

    // Get cached event to verify it exists and get googleEventId
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

    const cachedEvent = eventDoc.data() as CalendarEvent;
    const googleEventId = cachedEvent.googleEventId || eventId;

    // Fetch latest version from Google Calendar
    const accessToken = await getCalendarAccessToken(userId);
    const client = new GoogleCalendarClient(accessToken);
    const calendarId = "primary"; // TODO: Support multiple calendars

    let googleEvent;
    try {
      googleEvent = await client.getEvent(calendarId, googleEventId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // If event was deleted in Google Calendar, remove from cache
      if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
        await eventsCollection.doc(eventId).delete();
        return NextResponse.json(
          { 
            ok: true,
            deleted: true,
            message: "Event was deleted in Google Calendar and has been removed from cache"
          },
          { status: 200 }
        );
      }

      throw error;
    }

    // Convert Google event to Firestore format
    const isAllDay = !googleEvent.start.dateTime && !!googleEvent.start.date;
    
    let startTimestamp: Timestamp;
    let endTimestamp: Timestamp;

    if (isAllDay) {
      const [startYear, startMonth, startDay] = (googleEvent.start.date || "").split("-").map(Number);
      const [endYear, endMonth, endDay] = (googleEvent.end.date || "").split("-").map(Number);
      
      startTimestamp = Timestamp.fromDate(new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0)));
      
      // Google's end.date is exclusive, so subtract 1 day
      const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));
      endDate.setUTCDate(endDate.getUTCDate() - 1);
      endDate.setUTCHours(23, 59, 59, 999);
      endTimestamp = Timestamp.fromDate(endDate);
    } else {
      startTimestamp = Timestamp.fromDate(new Date(googleEvent.start.dateTime!));
      endTimestamp = Timestamp.fromDate(new Date(googleEvent.end.dateTime!));
    }

    const googleUpdated = googleEvent.updated
      ? Timestamp.fromDate(new Date(googleEvent.updated))
      : FieldValue.serverTimestamp();

    // Update Firestore cache
    const updateData: Partial<CalendarEvent> = {
      title: googleEvent.summary || cachedEvent.title,
      description: googleEvent.description !== undefined ? (googleEvent.description || null) : undefined,
      location: googleEvent.location !== undefined ? (googleEvent.location || null) : undefined,
      attendees: googleEvent.attendees?.map((a) => {
        const attendee: { email: string; displayName?: string } = {
          email: a.email,
        };
        // Only include displayName if it exists (Firestore doesn't accept undefined)
        if (a.displayName) {
          attendee.displayName = a.displayName;
        }
        return attendee;
      }),
      startTime: startTimestamp,
      endTime: endTimestamp,
      lastSyncedAt: FieldValue.serverTimestamp(),
      etag: googleEvent.etag,
      googleUpdated: googleUpdated as Timestamp,
      isDirty: false, // Just refreshed from Google, so clean
      updatedAt: FieldValue.serverTimestamp(),
    };

    await eventsCollection.doc(eventId).update(updateData);

    // Fetch updated event
    const updatedEventDoc = await eventsCollection.doc(eventId).get();
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
      context: "Refreshing calendar event",
      tags: { component: "calendar-refresh-api" },
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

