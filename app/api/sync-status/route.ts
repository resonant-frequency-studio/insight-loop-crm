import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { getLastSyncForService } from "@/lib/sync-jobs-server";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";

/**
 * GET /api/sync-status
 * Get the last sync job for a specific service
 * Query params: ?service=gmail|calendar
 */
export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const url = new URL(req.url);
    const serviceParam = url.searchParams.get("service") as "gmail" | "calendar" | null;

    if (!serviceParam || (serviceParam !== "gmail" && serviceParam !== "calendar")) {
      return NextResponse.json(
        { error: "Invalid or missing service parameter. Must be 'gmail' or 'calendar'" },
        { status: 400 }
      );
    }

    const lastSync = await getLastSyncForService(userId, serviceParam);

    return NextResponse.json({
      lastSync: lastSync || null,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    reportException(err, {
      context: "Fetching sync status by service",
      tags: { component: "sync-status-api" },
      extra: { originalError: errorMessage },
    });
    
    const friendlyError = toUserFriendlyError(err);
    
    return NextResponse.json(
      { 
        error: friendlyError,
        lastSync: null,
      },
      { status: 500 }
    );
  }
}

