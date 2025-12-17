import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";
import { getContactTimeline } from "@/lib/timeline/get-contact-timeline";
import { getContactForUser } from "@/lib/contacts-server";

/**
 * GET /api/contacts/[contactId]/timeline
 * Get unified timeline for a contact (calendar events, touchpoints, action items, emails)
 * 
 * Query params:
 * - limit?: number (default: 50)
 * - before?: ISO date string (cursor for pagination)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const userId = await getUserId();
    const { contactId: contactIdParam } = await params;
    const contactId = decodeURIComponent(contactIdParam);

    // Verify contact exists
    const contact = await getContactForUser(userId, contactId);
    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const beforeParam = url.searchParams.get("before");

    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const before = beforeParam ? new Date(beforeParam) : undefined;

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Invalid limit parameter. Must be between 1 and 100." },
        { status: 400 }
      );
    }

    if (before && isNaN(before.getTime())) {
      return NextResponse.json(
        { error: "Invalid before parameter. Must be a valid ISO date string." },
        { status: 400 }
      );
    }

    // Fetch timeline items
    const timelineItems = await getContactTimeline(
      adminDb,
      userId,
      contactId,
      { limit, before }
    );

    return NextResponse.json({ timelineItems });
  } catch (error) {
    reportException(error, {
      context: "Fetching contact timeline",
      tags: { component: "contact-timeline-api" },
    });
    const friendlyError = toUserFriendlyError(error);
    return NextResponse.json(
      { error: friendlyError },
      { status: 500 }
    );
  }
}

