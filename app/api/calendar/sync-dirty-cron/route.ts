import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { syncAllDirtyEvents } from "@/lib/calendar/sync-dirty-events";
import { reportException } from "@/lib/error-reporting";
import { getAllUsersWithCalendarAccess } from "@/lib/calendar/cron-helpers";

/**
 * POST /api/calendar/sync-dirty-cron
 * Internal cron endpoint for syncing dirty events
 * This endpoint is designed to be called by Vercel cron jobs
 * It syncs dirty events for all users with calendar access
 */
export async function POST(req: Request) {
  try {
    // Validate this is a Vercel cron request
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CALENDAR_SYNC_CRON_SECRET;
    const isVercelCron = req.headers.get("x-vercel-cron") !== null;

    // Allow if it's a Vercel cron request OR if secret is provided
    const isValid = isVercelCron || (cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (!isValid) {
      return NextResponse.json(
        { error: "Unauthorized - cron secret or Vercel cron header required" },
        { status: 401 }
      );
    }

    // Get all users with calendar access and sync their dirty events
    const users = await getAllUsersWithCalendarAccess(adminDb);
    let totalSynced = 0;
    let totalErrors = 0;
    let totalConflicts = 0;
    const errors: string[] = [];

    for (const userId of users) {
      try {
        const result = await syncAllDirtyEvents(adminDb, userId, 50);
        totalSynced += result.synced;
        totalErrors += result.errors;
        totalConflicts += result.conflicts;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`User ${userId}: ${errorMessage}`);
        totalErrors++;
        reportException(error, {
          context: "Syncing dirty events for user in cron",
          tags: { component: "calendar-sync-dirty-cron", userId },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      usersProcessed: users.length,
      totalSynced,
      totalErrors,
      totalConflicts,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    reportException(err, {
      context: "Calendar sync-dirty cron job",
      tags: { component: "calendar-sync-dirty-cron" },
      extra: { originalError: errorMessage },
    });
    
    return NextResponse.json(
      { 
        ok: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

