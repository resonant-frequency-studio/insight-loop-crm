import { NextResponse } from "next/server";
import { runSyncJob } from "@/lib/gmail/sync-job-runner";
import { getUserId } from "@/lib/auth-utils";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";

/**
 * GET /api/gmail/sync
 * Manual sync endpoint - uses the sync job runner
 * Supports query params: ?type=initial|incremental|auto
 * 
 * OPTIMIZATIONS:
 * - Uses blind upserts (no existence checks) to reduce Firestore reads by ~50%
 * - See lib/gmail/incremental-sync.ts for detailed optimization notes
 * - Estimated reads: ~1 per message (for contact lookup) vs ~2 before optimization
 */
export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const url = new URL(req.url);
    const typeParam = url.searchParams.get("type") as
      | "initial"
      | "incremental"
      | "auto"
      | null;

    const result = await runSyncJob({
      userId,
      type: typeParam || "auto",
    });

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.errorMessage ? toUserFriendlyError(result.errorMessage) : "Sync failed. Please try again.",
          syncJobId: result.syncJobId,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      syncJobId: result.syncJobId,
      threadsProcessed: result.processedThreads,
      messagesProcessed: result.processedMessages,
      errors: result.errors,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    reportException(err, {
      context: "Gmail sync error",
      tags: { component: "gmail-sync-api" },
      extra: { originalError: errorMessage },
    });
    
    // Preserve Gmail-specific error messages
    const friendlyError = toUserFriendlyError(err);
    
    return NextResponse.json(
      { 
        ok: false, 
        error: friendlyError,
        // Include original error in development for debugging
        ...(process.env.NODE_ENV === "development" && { debug: errorMessage })
      },
      { status: 500 }
    );
  }
}
