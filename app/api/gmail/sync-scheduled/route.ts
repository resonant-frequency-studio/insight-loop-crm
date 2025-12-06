import { NextResponse } from "next/server";
import { runSyncForAllUsers, runSyncJob } from "@/lib/gmail/sync-job-runner";
import { getUserId } from "@/lib/auth-utils";

/**
 * POST /api/gmail/sync-scheduled
 * Manual trigger for scheduled sync (can be called by cron services)
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

      const result = await runSyncJob({
        userId,
        type: "auto",
      });

      return NextResponse.json({
        ok: result.success,
        syncJobId: result.syncJobId,
        processedThreads: result.processedThreads,
        processedMessages: result.processedMessages,
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

    const results = await runSyncForAllUsers();

    return NextResponse.json({
      ok: true,
      usersProcessed: results.length,
      results: results.map((r) => ({
        userId: r.userId,
        success: r.result.success,
        syncJobId: r.result.syncJobId,
        processedThreads: r.result.processedThreads,
        processedMessages: r.result.processedMessages,
      })),
    });
  } catch (error) {
    console.error("Scheduled sync error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/gmail/sync-scheduled
 * Same as POST, but allows triggering from browser for testing
 */
export async function GET(req: Request) {
  return POST(req);
}

