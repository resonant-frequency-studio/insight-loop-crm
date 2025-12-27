import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { renewExpiringChannels } from "@/lib/calendar/webhook-manager";
import { reportException } from "@/lib/error-reporting";

/**
 * POST /api/calendar/renew-subscriptions-cron
 * Internal cron endpoint for renewing webhook subscriptions
 * This endpoint is designed to be called by Vercel cron jobs
 */
export async function POST(req: Request) {
  try {
    // Validate this is a Vercel cron request
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CALENDAR_SYNC_CRON_SECRET;
    const isVercelCron = req.headers.get("x-vercel-cron") !== null;

    // Allow if it's a Vercel cron request OR if secret is provided
    const isValid = isVercelCron || (cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (!isValid) {
      return NextResponse.json(
        { error: "Unauthorized - cron secret or Vercel cron header required" },
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
      context: "Renewing calendar webhook subscriptions (cron)",
      tags: { component: "calendar-renew-subscriptions-cron" },
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

