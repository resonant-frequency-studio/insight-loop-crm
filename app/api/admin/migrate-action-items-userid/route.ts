import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { actionItemsPath } from "@/lib/action-items";
import { contactsPath } from "@/lib/firestore-paths";
import { reportException, reportMessage, ErrorLevel } from "@/lib/error-reporting";

/**
 * POST /api/admin/migrate-action-items-userid
 * Backfill userId field for existing action items that may be missing it
 * This is required for the collection group query optimization
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    const { dryRun = false, limit = 100 } = await request.json();

    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{
        contactId: string;
        actionItemId: string;
        action: "updated" | "skipped" | "error";
        error?: string;
      }>,
    };

    // Get all contacts
    const contactsSnapshot = await adminDb
      .collection(contactsPath(userId))
      .limit(limit)
      .get();

    if (contactsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No contacts found",
        results,
      });
    }

    // Process each contact's action items
    for (const contactDoc of contactsSnapshot.docs) {
      const contactId = contactDoc.id;
      const actionItemsRef = adminDb.collection(actionItemsPath(userId, contactId));

      try {
        const actionItemsSnapshot = await actionItemsRef.get();

        for (const actionItemDoc of actionItemsSnapshot.docs) {
          results.processed++;
          const data = actionItemDoc.data();
          const actionItemId = actionItemDoc.id;

          // Check if userId is missing or incorrect
          if (!data.userId || data.userId !== userId) {
            if (dryRun) {
              results.skipped++;
              results.details.push({
                contactId,
                actionItemId,
                action: "skipped",
              });
            } else {
              try {
                await actionItemDoc.ref.update({
                  userId,
                });
                results.updated++;
                results.details.push({
                  contactId,
                  actionItemId,
                  action: "updated",
                });
              } catch (error) {
                results.errors++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                results.details.push({
                  contactId,
                  actionItemId,
                  action: "error",
                  error: errorMessage,
                });
                reportException(error, {
                  context: "Updating action item userId",
                  tags: { component: "migrate-action-items-userid", contactId, actionItemId },
                });
              }
            }
          } else {
            results.skipped++;
            results.details.push({
              contactId,
              actionItemId,
              action: "skipped",
            });
          }
        }
      } catch (error) {
        reportException(error, {
          context: "Processing contact action items",
          tags: { component: "migrate-action-items-userid", contactId },
        });
        results.errors++;
      }
    }

    const message = dryRun
      ? `Dry run: Would update ${results.updated} action items`
      : `Updated ${results.updated} action items, ${results.skipped} already had userId, ${results.errors} errors`;

    reportMessage(message, ErrorLevel.INFO, {
      context: "Action items userId migration",
      tags: { component: "migrate-action-items-userid", userId },
      extra: results,
    });

    return NextResponse.json({
      success: results.errors === 0,
      message,
      results,
    });
  } catch (error) {
    reportException(error, {
      context: "Action items userId migration",
      tags: { component: "migrate-action-items-userid" },
    });
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

