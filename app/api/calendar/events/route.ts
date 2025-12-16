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
import { Contact } from "@/types/firestore";

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
      contacts
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

