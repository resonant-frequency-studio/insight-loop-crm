import { NextResponse } from "next/server";
import { runContactsSyncJob } from "@/lib/google-contacts/sync-job-runner";
import { getUserId } from "@/lib/auth-utils";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";

/**
 * GET /api/contacts/sync
 * Manual contacts import endpoint - uses the sync job runner
 * Returns immediately after starting the job, allowing the client to track progress via Firestore
 */
export async function GET(req: Request) {
  try {
    const userId = await getUserId();

    // Generate sync job ID upfront so we can return it immediately
    const syncJobId = `contacts_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Start the sync job asynchronously (fire-and-forget)
    // Errors will be handled by the sync job runner and written to Firestore
    runContactsSyncJob({
      userId,
      syncJobId,
    }).catch((error) => {
      // Log any unhandled errors from the background job
      reportException(error, {
        context: "Background contacts sync job error",
        tags: { component: "contacts-sync-api", syncJobId },
      });
    });

    // Return immediately with the sync job ID
    return NextResponse.json({
      ok: true,
      syncJobId,
      message: "Contacts sync job started. Track progress via sync job status.",
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    reportException(err, {
      context: "Contacts sync error",
      tags: { component: "contacts-sync-api" },
      extra: { originalError: errorMessage },
    });

    // Preserve Google-specific error messages
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

