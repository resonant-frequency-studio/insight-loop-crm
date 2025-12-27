import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { unsubscribeFromCalendar } from "@/lib/calendar/webhook-manager";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";

/**
 * POST /api/calendar/unsubscribe
 * Unsubscribe from Google Calendar push notifications
 * Query params:
 *   - channelId: Optional specific channel ID to unsubscribe (if not provided, unsubscribes all)
 */
export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const url = new URL(req.url);
    const channelId = url.searchParams.get("channelId") || undefined;

    await unsubscribeFromCalendar(adminDb, userId, channelId);

    return NextResponse.json({
      ok: true,
      message: "Successfully unsubscribed from calendar notifications",
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    reportException(err, {
      context: "Unsubscribing from calendar webhook",
      tags: { component: "calendar-unsubscribe-api" },
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

