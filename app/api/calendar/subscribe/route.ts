import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { subscribeToCalendar, hasActiveSubscription } from "@/lib/calendar/webhook-manager";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";

/**
 * POST /api/calendar/subscribe
 * Subscribe to Google Calendar push notifications
 * Query params:
 *   - calendarId: Calendar ID to subscribe to (default: "primary")
 */
export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const url = new URL(req.url);
    const calendarId = url.searchParams.get("calendarId") || "primary";

    // Check if user already has an active subscription
    const hasActive = await hasActiveSubscription(adminDb, userId);
    if (hasActive) {
      return NextResponse.json({
        ok: true,
        message: "Active subscription already exists",
        alreadySubscribed: true,
      });
    }

    // Create new subscription
    const channel = await subscribeToCalendar(adminDb, userId, calendarId);

    return NextResponse.json({
      ok: true,
      channelId: channel.channelId,
      expiration: channel.expiration.toDate().toISOString(),
      message: "Successfully subscribed to calendar notifications",
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    reportException(err, {
      context: "Subscribing to calendar webhook",
      tags: { component: "calendar-subscribe-api" },
      extra: { originalError: errorMessage },
    });
    
    const friendlyError = toUserFriendlyError(err);
    
    if (errorMessage.includes("Calendar access") || errorMessage.includes("permission")) {
      return NextResponse.json(
        { 
          ok: false,
          error: friendlyError,
          requiresReauth: true,
        },
        { status: 403 }
      );
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

