import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { updateGoogleEvent, ConflictResponse } from "@/lib/calendar/write-calendar-event";
import { CalendarEvent } from "@/types/firestore";

/**
 * PATCH /api/calendar/events/[eventId]/update
 * Update an existing calendar event
 * Body: {
 *   title?: string
 *   description?: string
 *   startTime?: ISO date string
 *   endTime?: ISO date string
 *   location?: string
 *   attendees?: string[]
 *   isAllDay?: boolean
 *   timeZone?: string
 * }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const userId = await getUserId();
    const { eventId } = await params;
    const body = await req.json();

    // Get cached event to retrieve etag
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
    const etag = cachedEvent.etag;

    // Parse dates if provided
    let startTime: Date | undefined;
    let endTime: Date | undefined;

    if (body.startTime) {
      startTime = new Date(body.startTime);
      if (isNaN(startTime.getTime())) {
        return NextResponse.json(
          { error: "Invalid startTime format. Use ISO 8601 format." },
          { status: 400 }
        );
      }
    }

    if (body.endTime) {
      endTime = new Date(body.endTime);
      if (isNaN(endTime.getTime())) {
        return NextResponse.json(
          { error: "Invalid endTime format. Use ISO 8601 format." },
          { status: 400 }
        );
      }
    }

    if (startTime && endTime && startTime >= endTime) {
      return NextResponse.json(
        { error: "endTime must be after startTime" },
        { status: 400 }
      );
    }

    // Update event in Google Calendar
    const result = await updateGoogleEvent({
      userId,
      calendarId: body.calendarId,
      googleEventId: eventId,
      title: body.title,
      description: body.description,
      startTime,
      endTime,
      location: body.location,
      attendees: body.attendees,
      isAllDay: body.isAllDay,
      timeZone: body.timeZone,
      etag, // Use cached etag for conflict detection
    });

    // Check if this is a conflict response
    if ("conflict" in result && result.conflict) {
      const conflict = result as ConflictResponse;
      return NextResponse.json(
        {
          ok: false,
          conflict: true,
          reason: conflict.reason,
          googleEvent: conflict.googleEvent,
          localEvent: conflict.localEvent,
          cachedEvent: {
            etag: conflict.cachedEvent?.etag,
            googleUpdated: cachedEvent.googleUpdated,
          },
        },
        { status: 409 }
      );
    }

    // Success - update Firestore cache
    const googleEvent = result as import("@/lib/calendar/google-calendar-client").GoogleCalendarEvent;

    // Convert Google event dates to Firestore Timestamps
    const isAllDay = !googleEvent.start.dateTime && !!googleEvent.start.date;
    
    let startTimestamp: Timestamp | undefined;
    let endTimestamp: Timestamp | undefined;

    if (googleEvent.start.dateTime || googleEvent.start.date) {
      if (isAllDay) {
        const [startYear, startMonth, startDay] = (googleEvent.start.date || "").split("-").map(Number);
        const [endYear, endMonth, endDay] = (googleEvent.end.date || "").split("-").map(Number);
        
        startTimestamp = Timestamp.fromDate(new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0)));
        
        const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));
        endDate.setUTCDate(endDate.getUTCDate() - 1);
        endDate.setUTCHours(23, 59, 59, 999);
        endTimestamp = Timestamp.fromDate(endDate);
      } else {
        startTimestamp = Timestamp.fromDate(new Date(googleEvent.start.dateTime!));
        endTimestamp = Timestamp.fromDate(new Date(googleEvent.end.dateTime!));
      }
    }

    // Convert Google's updated timestamp
    const googleUpdated = googleEvent.updated
      ? Timestamp.fromDate(new Date(googleEvent.updated))
      : FieldValue.serverTimestamp();

    // Prepare update data
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
      lastSyncedAt: FieldValue.serverTimestamp(),
      etag: googleEvent.etag,
      googleUpdated: googleUpdated as Timestamp,
      isDirty: false, // Just synced, so clean
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Update timestamps if they changed
    if (startTimestamp) {
      updateData.startTime = startTimestamp;
    }
    if (endTimestamp) {
      updateData.endTime = endTimestamp;
    }

    // Preserve existing fields that shouldn't be overwritten
    // (matchedContactId, matchConfidence, contactSnapshot, etc. are preserved automatically)

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
      context: "Updating calendar event",
      tags: { component: "calendar-update-api" },
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

