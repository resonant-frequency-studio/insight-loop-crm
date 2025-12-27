import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { hasActiveSubscription } from "@/lib/calendar/webhook-manager";
import { getUserChannels } from "@/lib/calendar/channel-storage";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";

/**
 * GET /api/calendar/subscription-status
 * Get the webhook subscription status for the current user
 */
export async function GET() {
  try {
    const userId = await getUserId();
    
    const isActive = await hasActiveSubscription(adminDb, userId);
    const channels = await getUserChannels(adminDb, userId);
    
    // Get the most recent channel expiration
    let expiresAt: Date | null = null;
    if (channels.length > 0) {
      const mostRecent = channels.sort((a, b) => 
        b.expiration.toMillis() - a.expiration.toMillis()
      )[0];
      expiresAt = mostRecent.expiration.toDate();
    }

    return NextResponse.json({
      ok: true,
      hasActiveSubscription: isActive,
      expiresAt: expiresAt?.toISOString() || null,
      channelCount: channels.length,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    reportException(err, {
      context: "Getting calendar subscription status",
      tags: { component: "calendar-subscription-status-api" },
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

