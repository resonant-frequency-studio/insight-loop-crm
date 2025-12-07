import { NextResponse } from "next/server";
import { runSyncJob } from "@/lib/gmail/sync-job-runner";
import { getUserId } from "@/lib/auth-utils";

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
          error: result.errorMessage,
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
    console.error("SYNC ERROR:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
