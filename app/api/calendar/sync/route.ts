import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { getCalendarAccessToken } from "@/lib/calendar/get-access-token";
import { getCalendarEventsFromGoogle } from "@/lib/calendar/get-calendar-events";
import { syncCalendarEventsToFirestore } from "@/lib/calendar/sync-calendar-events";
import { reportException } from "@/lib/error-reporting";
import { adminDb } from "@/lib/firebase-admin";
import { toUserFriendlyError } from "@/lib/error-utils";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/calendar/sync
 * Manual sync trigger for calendar events
 * Syncs events for the next 60 days from now
 */
export async function POST() {
  const jobId = `calendar_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let syncJobCreated = false;
  let userId: string = "";

  try {
    console.log('[Calendar Sync API] Starting sync...');
    userId = await getUserId();
    console.log('[Calendar Sync API] User authenticated:', userId);
    
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
      });
    syncJobCreated = true;
    
    // Sync events for the next 60 days
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 60);

    // Fetch from Google Calendar API
    const accessToken = await getCalendarAccessToken(userId);
    const googleEvents = await getCalendarEventsFromGoogle(
      accessToken,
      timeMin,
      timeMax
    );

    // Sync to Firestore
    const syncResult = await syncCalendarEventsToFirestore(
      adminDb,
      userId,
      googleEvents.items
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

