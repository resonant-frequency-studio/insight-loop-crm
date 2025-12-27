import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { syncAllDirtyEvents } from "@/lib/calendar/sync-dirty-events";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";

/**
 * POST /api/calendar/sync-dirty
 * Sync all dirty events from CRM to Google Calendar
 * Can be called by authenticated users or by cron jobs with secret
 * Query params:
 *   - limit: Maximum number of events to sync (default: 50)
 *   - userId: Optional user ID to sync (requires auth or cron secret)
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const userIdParam = url.searchParams.get("userId");

    let userId: string;
    const cronSecret = process.env.CALENDAR_SYNC_CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    const secretParam = url.searchParams.get("secret");

    // Check if this is a cron call with secret (header or query param)
    const isCronCall = cronSecret && (
      authHeader === `Bearer ${cronSecret}` ||
      secretParam === cronSecret
    );

    // If userId provided, check if it's a cron call or authenticated user
    if (userIdParam) {
      if (isCronCall) {
        userId = userIdParam;
      } else {
        // Otherwise, require authentication and verify user matches
        const authenticatedUserId = await getUserId();
        if (authenticatedUserId !== userIdParam) {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 403 }
          );
        }
        userId = authenticatedUserId;
      }
    } else {
      // No userId param - require authentication (cron can't call without userId)
      if (isCronCall) {
        return NextResponse.json(
          { error: "userId query parameter required for cron calls" },
          { status: 400 }
        );
      }
      userId = await getUserId();
    }

    const result = await syncAllDirtyEvents(adminDb, userId, limit);

    return NextResponse.json({
      ok: true,
      synced: result.synced,
      errors: result.errors,
      conflicts: result.conflicts,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    reportException(err, {
      context: "Syncing dirty calendar events",
      tags: { component: "calendar-sync-dirty-api" },
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

