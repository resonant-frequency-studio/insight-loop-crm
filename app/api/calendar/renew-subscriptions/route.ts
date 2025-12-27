import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { renewExpiringChannels } from "@/lib/calendar/webhook-manager";
import { reportException } from "@/lib/error-reporting";

/**
 * POST /api/calendar/renew-subscriptions
 * Renew expiring calendar webhook subscriptions
 * Should be called by a cron job daily to ensure subscriptions don't expire
 * Requires CALENDAR_SYNC_CRON_SECRET in Authorization header
 */
export async function POST(req: Request) {
  try {
    // Validate cron secret (supports header or query parameter for Vercel cron jobs)
    const url = new URL(req.url);
    const authHeader = req.headers.get("authorization");
    const secretParam = url.searchParams.get("secret");
    const cronSecret = process.env.CALENDAR_SYNC_CRON_SECRET;

    const isValidSecret = cronSecret && (
      authHeader === `Bearer ${cronSecret}` ||
      secretParam === cronSecret
    );

    if (!isValidSecret) {
      return NextResponse.json(
        { error: "Unauthorized - cron secret required" },
        { status: 401 }
      );
    }

    // Renew expiring channels
    const renewedCount = await renewExpiringChannels(adminDb);

    return NextResponse.json({
      ok: true,
      renewed: renewedCount,
      message: `Renewed ${renewedCount} expiring webhook subscription(s)`,
    });
  } catch (error) {
    reportException(error, {
      context: "Renewing calendar webhook subscriptions",
      tags: { component: "calendar-renew-subscriptions-api" },
    });

    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/calendar/renew-subscriptions
 * Same as POST, but allows triggering from browser for testing
 */
export async function GET(req: Request) {
  return POST(req);
}

