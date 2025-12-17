import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { getCalendarAccessToken } from "@/lib/calendar/get-access-token";
import { getCalendarEventsFromGoogle } from "@/lib/calendar/get-calendar-events";
import { syncCalendarEventsToFirestore } from "@/lib/calendar/sync-calendar-events";
import { getCalendarEventsForUser } from "@/lib/calendar/get-calendar-events-server";
import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";
import { getAllContactsForUserUncached } from "@/lib/contacts-server";
import { Contact, CalendarEvent } from "@/types/firestore";
import { createGoogleEvent } from "@/lib/calendar/write-calendar-event";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/calendar/events
 * Fetch calendar events for the authenticated user
 * Query params:
 *   - timeMin: ISO date string (required)
 *   - timeMax: ISO date string (required)
 *   - forceRefresh: boolean (optional, default: false)
 */
export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const url = new URL(req.url);
    
    const timeMinParam = url.searchParams.get("timeMin");
    const timeMaxParam = url.searchParams.get("timeMax");
    const forceRefresh = url.searchParams.get("forceRefresh") === "true";

    if (!timeMinParam || !timeMaxParam) {
      return NextResponse.json(
        { error: "timeMin and timeMax query parameters are required" },
        { status: 400 }
      );
    }

    const timeMin = new Date(timeMinParam);
    const timeMax = new Date(timeMaxParam);

    if (isNaN(timeMin.getTime()) || isNaN(timeMax.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO 8601 format." },
        { status: 400 }
      );
    }

    console.log('[Calendar API] Request:', {
      userId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      forceRefresh,
    });

    // Check cache first (unless forceRefresh is true)
    if (!forceRefresh) {
      const cachedEvents = await getCalendarEventsForUser(
        adminDb,
        userId,
        timeMin,
        timeMax
      );

      console.log('[Calendar API] Cached events:', cachedEvents.length);

      // Check if cache is fresh (events synced within last 5 minutes)
      if (cachedEvents.length > 0) {
        // Check the most recent lastSyncedAt
        const mostRecentSync = cachedEvents
          .map((e) => {
            const syncTime = e.lastSyncedAt;
            if (syncTime instanceof Date) return syncTime.getTime();
            if (syncTime && typeof syncTime === "object" && "toDate" in syncTime) {
              return (syncTime as { toDate: () => Date }).toDate().getTime();
            }
            if (typeof syncTime === "string") {
              return new Date(syncTime).getTime();
            }
            return 0;
          })
          .reduce((max, time) => Math.max(max, time), 0);

        const cacheAge = Date.now() - mostRecentSync;
        const cacheAgeMinutes = Math.floor(cacheAge / (60 * 1000));
        
        // Log cached freshness info (no UI yet)
        console.log('[Calendar API] Cache freshness:', {
          eventCount: cachedEvents.length,
          cacheAgeMinutes,
          mostRecentSync: new Date(mostRecentSync).toISOString(),
          isFresh: cacheAge < CACHE_TTL_MS,
        });
        
        if (cacheAge < CACHE_TTL_MS) {
          return NextResponse.json({ events: cachedEvents });
        }
      }
    }

    // Fetch from Google Calendar API
    console.log('[Calendar API] Fetching from Google Calendar...');
    const accessToken = await getCalendarAccessToken(userId);
    const googleEvents = await getCalendarEventsFromGoogle(
      accessToken,
      timeMin,
      timeMax
    );

    console.log('[Calendar API] Google Calendar returned:', {
      itemsCount: googleEvents.items?.length || 0,
      hasNextPage: !!googleEvents.nextPageToken,
    });

    // Fetch contacts for matching
    let contacts: Contact[] = [];
    try {
      contacts = await getAllContactsForUserUncached(userId);
      console.log('[Calendar API] Fetched contacts for matching:', contacts.length);
    } catch (error) {
      // Log but don't fail sync if contacts fetch fails
      console.error('[Calendar API] Failed to fetch contacts for matching:', error);
      reportException(error, {
        context: "Fetching contacts for calendar event matching",
        tags: { component: "calendar-events-api", userId },
      });
    }

    // Sync to Firestore with contact matching
    const syncResult = await syncCalendarEventsToFirestore(
      adminDb,
      userId,
      googleEvents.items,
      contacts,
      timeMin, // Pass time range for cleanup
      timeMax
    );

    console.log('[Calendar API] Sync result:', syncResult);

    // Get synced events from Firestore
    const syncedEvents = await getCalendarEventsForUser(
      adminDb,
      userId,
      timeMin,
      timeMax
    );

    console.log('[Calendar API] Returning events:', syncedEvents.length);

    return NextResponse.json({
      events: syncedEvents,
      syncStats: {
        synced: syncResult.synced,
        errors: syncResult.errors,
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    reportException(err, {
      context: "Calendar events API error",
      tags: { component: "calendar-events-api" },
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

/**
 * POST /api/calendar/events
 * Create a new calendar event
 * Body: {
 *   title: string (required)
 *   description?: string
 *   startTime: ISO date string (required)
 *   endTime: ISO date string (required)
 *   location?: string
 *   attendees?: string[] (email addresses)
 *   contactId?: string (optional - link to contact)
 *   isAllDay?: boolean
 *   timeZone?: string
 * }
 */
export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();

    // Validate required fields
    if (!body.title || !body.startTime || !body.endTime) {
      return NextResponse.json(
        { error: "title, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    // Parse dates
    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO 8601 format." },
        { status: 400 }
      );
    }

    if (startTime >= endTime) {
      return NextResponse.json(
        { error: "endTime must be after startTime" },
        { status: 400 }
      );
    }

    // Create event in Google Calendar
    const googleEvent = await createGoogleEvent({
      userId,
      calendarId: body.calendarId,
      title: body.title,
      description: body.description,
      startTime,
      endTime,
      location: body.location,
      attendees: body.attendees,
      isAllDay: body.isAllDay || false,
      timeZone: body.timeZone,
    });

    // Convert Google event dates to Firestore Timestamps
    const isAllDay = !googleEvent.start.dateTime && !!googleEvent.start.date;
    
    let startTimestamp: Timestamp;
    let endTimestamp: Timestamp;

    if (isAllDay) {
      // All-day events
      const [startYear, startMonth, startDay] = (googleEvent.start.date || "").split("-").map(Number);
      const [endYear, endMonth, endDay] = (googleEvent.end.date || "").split("-").map(Number);
      
      startTimestamp = Timestamp.fromDate(new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0)));
      
      // Google's end.date is exclusive, so subtract one day and set to end of day
      const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));
      endDate.setUTCDate(endDate.getUTCDate() - 1);
      endDate.setUTCHours(23, 59, 59, 999);
      endTimestamp = Timestamp.fromDate(endDate);
    } else {
      // Timed events
      startTimestamp = Timestamp.fromDate(new Date(googleEvent.start.dateTime!));
      endTimestamp = Timestamp.fromDate(new Date(googleEvent.end.dateTime!));
    }

    // Convert Google's updated timestamp
    const googleUpdated = googleEvent.updated
      ? Timestamp.fromDate(new Date(googleEvent.updated))
      : FieldValue.serverTimestamp();

    // Prepare event data for Firestore
    const eventData: Omit<CalendarEvent, "eventId"> = {
      googleEventId: googleEvent.id,
      userId,
      title: googleEvent.summary || body.title,
      description: googleEvent.description || body.description || null,
      startTime: startTimestamp,
      endTime: endTimestamp,
      location: googleEvent.location || body.location || null,
      attendees: googleEvent.attendees?.map((a) => {
        const attendee: { email: string; displayName?: string } = {
          email: a.email,
        };
        // Only include displayName if it exists (Firestore doesn't accept undefined)
        if (a.displayName) {
          attendee.displayName = a.displayName;
        }
        return attendee;
      }) || [],
      lastSyncedAt: FieldValue.serverTimestamp(),
      etag: googleEvent.etag,
      googleUpdated: googleUpdated as Timestamp,
      sourceOfTruth: "crm_touchpoint", // Created from CRM (not from touchpoint, but from CRM directly)
      isDirty: false, // Just synced, so clean
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Link to contact if provided
    if (body.contactId) {
      eventData.matchedContactId = body.contactId;
      eventData.matchMethod = "manual";

      // Optionally fetch contact for snapshot
      try {
        const contacts = await getAllContactsForUserUncached(userId);
        const contact = contacts.find((c) => c.contactId === body.contactId);
        if (contact) {
          eventData.contactSnapshot = {
            name: `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.primaryEmail,
            segment: contact.segment || null,
            tags: contact.tags || [],
            primaryEmail: contact.primaryEmail,
            engagementScore: contact.engagementScore || null,
            snapshotUpdatedAt: FieldValue.serverTimestamp(),
          };
        }
      } catch (error) {
        // Log but don't fail if contact fetch fails
        reportException(error, {
          context: "Fetching contact for event creation",
          tags: { component: "calendar-events-api", userId },
        });
      }
    }

    // Store in Firestore
    const eventsCollection = adminDb
      .collection("users")
      .doc(userId)
      .collection("calendarEvents");

    await eventsCollection.doc(googleEvent.id).set(eventData);

    // Fetch the created event to return (with proper timestamp conversion)
    const createdEventDoc = await eventsCollection.doc(googleEvent.id).get();
    const createdEvent = createdEventDoc.data() as CalendarEvent;

    return NextResponse.json({
      ok: true,
      event: createdEvent,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    reportException(err, {
      context: "Creating calendar event",
      tags: { component: "calendar-events-api" },
      extra: { originalError: errorMessage },
    });
    
    const friendlyError = toUserFriendlyError(err);
    
    // Check for auth errors (including missing account)
    if (
      errorMessage.includes("Calendar access") || 
      errorMessage.includes("permission") ||
      errorMessage.includes("No Google account linked") ||
      errorMessage.includes("connect your Gmail account")
    ) {
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

