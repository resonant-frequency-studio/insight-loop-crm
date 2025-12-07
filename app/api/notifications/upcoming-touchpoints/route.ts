import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getUserId } from "@/lib/auth-utils";
import {
  getTouchpointsNeedingReminders,
  getUpcomingTouchpoints,
} from "@/lib/touchpoint-reminders";
import { reportException } from "@/lib/error-reporting";

/**
 * GET /api/notifications/upcoming-touchpoints
 * Get touchpoints that need reminders or are upcoming
 */
export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "reminders"; // "reminders" or "upcoming"
    const daysAhead = parseInt(url.searchParams.get("daysAhead") || "60");

    if (type === "reminders") {
      const reminders = await getTouchpointsNeedingReminders(
        adminDb,
        userId,
        daysAhead
      );
      return NextResponse.json({ reminders });
    } else {
      const touchpoints = await getUpcomingTouchpoints(
        adminDb,
        userId,
        daysAhead
      );
      return NextResponse.json({ touchpoints });
    }
  } catch (error) {
    reportException(error, {
      context: "Fetching touchpoint reminders",
      tags: { component: "upcoming-touchpoints-api" },
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

