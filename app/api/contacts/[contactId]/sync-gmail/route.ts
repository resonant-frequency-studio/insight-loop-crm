import { NextResponse } from "next/server";
import { getUserId, getUserEmail } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { getContactForUser } from "@/lib/contacts-server";
import { getAccessToken } from "@/lib/gmail/get-access-token";
import { syncContactThreads } from "@/lib/gmail/sync-contact-threads";
import { summarizeContactThreads } from "@/lib/gmail/summarize-contact-threads";
import { generateContactInsights } from "@/lib/gmail/generate-contact-insights";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";
import { isOwnerContact } from "@/lib/contacts/owner-utils";

/**
 * POST /api/contacts/[contactId]/sync-gmail
 * Sync Gmail threads for a specific contact and generate insights
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const userId = await getUserId();
    const { contactId: contactIdParam } = await params;
    const contactId = decodeURIComponent(contactIdParam);

    // Fetch contact to get email address
    const contact = await getContactForUser(userId, contactId);

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    if (!contact.primaryEmail || !contact.primaryEmail.includes("@")) {
      return NextResponse.json(
        { error: "Contact does not have a valid email address" },
        { status: 400 }
      );
    }

    // Check if this is the owner contact - skip insights sync for owner
    const userEmail = await getUserEmail();
    if (isOwnerContact(userEmail, contact.primaryEmail)) {
      return NextResponse.json({
        ok: true,
        message: "Gmail insights are not available for owner contacts.",
        threadsProcessed: 0,
        messagesProcessed: 0,
        threadsSummarized: 0,
        insightsGenerated: false,
      });
    }

    // Get access token
    const accessToken = await getAccessToken(userId);

    // Step 1: Sync Gmail threads for this contact
    const syncResult = await syncContactThreads(
      adminDb,
      userId,
      contact.primaryEmail,
      contactId,
      accessToken
    );

    // Step 2: Generate summaries for threads that need them
    const summarizeResult = await summarizeContactThreads(
      adminDb,
      userId,
      contactId
    );

    // Step 3: Aggregate insights and update contact
    const insightsResult = await generateContactInsights(
      adminDb,
      userId,
      contactId
    );

    // Collect and convert errors to user-friendly messages
    const allErrors = [
      ...syncResult.errors.map((e) => toUserFriendlyError(e)),
      ...summarizeResult.errors.map((e) => toUserFriendlyError(e)),
      ...(insightsResult.error ? [toUserFriendlyError(insightsResult.error)] : []),
    ];

    // If sync completely failed (no threads processed), return error
    if (allErrors.length > 0 && syncResult.processedThreads === 0) {
      const primaryError = allErrors[0] || "Failed to sync Gmail threads for this contact.";
      return NextResponse.json(
        {
          ok: false,
          error: primaryError,
          threadsProcessed: syncResult.processedThreads,
          messagesProcessed: syncResult.processedMessages,
          threadsSummarized: summarizeResult.summarized,
          insightsGenerated: insightsResult.hasInsights,
        },
        { status: 500 }
      );
    }

    // If we processed some threads but had errors, return partial success
    const hasPartialSuccess = syncResult.processedThreads > 0;
    const successMessage = hasPartialSuccess
      ? `Synced ${syncResult.processedThreads} thread${syncResult.processedThreads !== 1 ? "s" : ""}${summarizeResult.summarized > 0 ? ` and generated ${summarizeResult.summarized} summary${summarizeResult.summarized !== 1 ? "ies" : ""}` : ""}.`
      : "Gmail sync completed successfully.";

    return NextResponse.json({
      ok: true,
      message: allErrors.length > 0 ? `${successMessage} Some errors occurred but the sync completed.` : successMessage,
      threadsProcessed: syncResult.processedThreads,
      messagesProcessed: syncResult.processedMessages,
      threadsSummarized: summarizeResult.summarized,
      insightsGenerated: insightsResult.hasInsights,
      errors: allErrors.length > 0 ? allErrors : undefined,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    reportException(err, {
      context: "Contact Gmail sync error",
      tags: { component: "contact-sync-gmail-api" },
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

