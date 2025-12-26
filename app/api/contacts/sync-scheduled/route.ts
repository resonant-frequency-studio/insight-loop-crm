import { NextResponse } from "next/server";
import {
  runContactsSyncForAllUsers,
  runContactsSyncJob,
} from "@/lib/google-contacts/sync-job-runner";
import { getUserId } from "@/lib/auth-utils";
import { reportException } from "@/lib/error-reporting";

/**
 * POST /api/contacts/sync-scheduled
 * Manual trigger for scheduled contacts sync (can be called by cron services)
 * If userId is provided in query, syncs that user only
 * Otherwise syncs all users (for cron jobs)
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const userIdParam = url.searchParams.get("userId");

    // If userId provided, sync that user only (requires auth)
    if (userIdParam) {
      const userId = await getUserId();
      if (userId !== userIdParam) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 403 }
        );
      }

      const result = await runContactsSyncJob({
        userId,
      });

      return NextResponse.json({
        ok: result.success,
        syncJobId: result.syncJobId,
        processedContacts: result.processedContacts,
        skippedContacts: result.skippedContacts,
        error: result.errorMessage,
      });
    }

    // Otherwise, sync all users (for cron - requires special header or secret)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Require authorization for all-user sync
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized - cron secret required" },
        { status: 401 }
      );
    }

    const results = await runContactsSyncForAllUsers();

    return NextResponse.json({
      ok: true,
      usersProcessed: results.length,
      results: results.map(({ userId, result }) => ({
        userId,
        success: result.success,
        processedContacts: result.processedContacts,
        skippedContacts: result.skippedContacts,
        error: result.errorMessage,
      })),
    });
  } catch (error) {
    reportException(error, {
      context: "Scheduled contacts sync error",
      tags: { component: "contacts-sync-scheduled-api" },
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

