import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { getContactForUser } from "@/lib/contacts-server";
import { generateContactInsights } from "@/lib/gmail/generate-contact-insights";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";

/**
 * POST /api/contacts/[contactId]/regenerate-summary
 * Regenerates the AI summary for a contact by re-aggregating thread summaries
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const userId = await getUserId();
    const { contactId: contactIdParam } = await params;
    const contactId = decodeURIComponent(contactIdParam);

    // Fetch contact to verify it exists
    const contact = await getContactForUser(userId, contactId);

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Regenerate insights by re-aggregating thread summaries
    const insightsResult = await generateContactInsights(
      adminDb,
      userId,
      contactId
    );

    if (!insightsResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: insightsResult.error || "Failed to regenerate summary",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Contact summary regenerated successfully",
      hasInsights: insightsResult.hasInsights,
    });
  } catch (err) {
    const { contactId: contactIdParam } = await params;
    const contactId = decodeURIComponent(contactIdParam);
    
    reportException(err, {
      context: "Regenerate contact summary error",
      tags: { component: "regenerate-summary-api", contactId },
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

