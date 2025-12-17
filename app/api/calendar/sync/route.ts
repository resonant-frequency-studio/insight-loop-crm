import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { getCalendarAccessToken } from "@/lib/calendar/get-access-token";
import { getCalendarEventsFromGoogle } from "@/lib/calendar/get-calendar-events";
import { syncCalendarEventsToFirestore } from "@/lib/calendar/sync-calendar-events";
import { reportException } from "@/lib/error-reporting";
import { adminDb } from "@/lib/firebase-admin";
import { toUserFriendlyError } from "@/lib/error-utils";
import { FieldValue } from "firebase-admin/firestore";
import { getAllContactsForUserUncached } from "@/lib/contacts-server";
import { Contact } from "@/types/firestore";

/**
 * POST /api/calendar/sync
 * Manual sync trigger for calendar events
 * Query params:
 *   - range: number of days to sync (default: 60)
 */
export async function POST(req: Request) {
  const jobId = `calendar_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let syncJobCreated = false;
  let userId: string = "";

  try {
    console.log('[Calendar Sync API] Starting sync...');
    userId = await getUserId();
    console.log('[Calendar Sync API] User authenticated:', userId);
    
    // Get range parameter from query string (default: 60 days)
    const url = new URL(req.url);
    const rangeParam = url.searchParams.get("range");
    const rangeDays = rangeParam ? parseInt(rangeParam, 10) : 60;
    
    // Validate range (must be one of the allowed values)
    const allowedRanges = [30, 60, 90, 180];
    const validRangeDays = allowedRanges.includes(rangeDays) ? rangeDays : 60;
    
    // Create sync job
    await adminDb
      .collection("users")
      .doc(userId)
      .collection("syncJobs")
      .doc(jobId)
      .set({
        syncJobId: jobId,
        userId,
        service: "calendar",
        type: "initial",
        status: "running",
        startedAt: FieldValue.serverTimestamp(),
        processedEvents: 0,
        rangeDays: validRangeDays, // Store range in sync job metadata
      });
    syncJobCreated = true;
    
    // Sync events for the specified range
    // Include past events (30 days back) and future events (rangeDays forward)
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30); // Go back 30 days to catch past events
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + validRangeDays);

    // Fetch from Google Calendar API
    const accessToken = await getCalendarAccessToken(userId);
    const googleEvents = await getCalendarEventsFromGoogle(
      accessToken,
      timeMin,
      timeMax
    );

    // Fetch contacts for matching
    let contacts: Contact[] = [];
    try {
      contacts = await getAllContactsForUserUncached(userId);
      console.log('[Calendar Sync API] Fetched contacts for matching:', contacts.length);
    } catch (error) {
      // Log but don't fail sync if contacts fetch fails
      console.error('[Calendar Sync API] Failed to fetch contacts for matching:', error);
      reportException(error, {
        context: "Fetching contacts for calendar event matching",
        tags: { component: "calendar-sync-api", userId },
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

    // Update sync job as complete
    await adminDb
      .collection("users")
      .doc(userId)
      .collection("syncJobs")
      .doc(jobId)
      .set({
        status: "complete",
        finishedAt: FieldValue.serverTimestamp(),
        processedEvents: syncResult.synced,
        errorMessage: syncResult.errors.length > 0 ? syncResult.errors.join("; ") : null,
      }, { merge: true });

    return NextResponse.json({
      ok: true,
      synced: syncResult.synced,
      deleted: syncResult.deleted,
      errors: syncResult.errors,
      totalEvents: googleEvents.items.length,
      syncJobId: jobId,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    console.error('[Calendar Sync API] Error:', errorMessage);
    
    reportException(err, {
      context: "Calendar sync error",
      tags: { component: "calendar-sync-api" },
      extra: { originalError: errorMessage },
    });
    
    // Check if it's an auth error
    if (errorMessage.includes("No session cookie") || errorMessage.includes("session")) {
      return NextResponse.json(
        { 
          ok: false,
          error: "Authentication required. Please log in and try again.",
        },
        { status: 401 }
      );
    }
    
    const friendlyError = toUserFriendlyError(err);
    
    // Update sync job as error if it was created
    if (syncJobCreated) {
      try {
        await adminDb
          .collection("users")
          .doc(userId)
          .collection("syncJobs")
          .doc(jobId)
          .set({
            status: "error",
            finishedAt: FieldValue.serverTimestamp(),
            errorMessage: friendlyError,
          }, { merge: true });
      } catch (updateError) {
        reportException(updateError, {
          context: "Failed to update calendar sync job status",
          tags: { component: "calendar-sync-api", userId },
        });
      }
    }
    
    return NextResponse.json(
      { 
        ok: false,
        error: friendlyError,
      },
      { status: 500 }
    );
  }
}

