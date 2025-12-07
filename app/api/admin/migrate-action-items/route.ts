import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { contactsPath } from "@/lib/firestore-paths";
import { importActionItemsFromText } from "@/lib/action-items";
import { Contact } from "@/types/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { QueryDocumentSnapshot, Query } from "firebase-admin/firestore";

/**
 * POST /api/admin/migrate-action-items
 * Migrate action items from old string field to new subcollection format
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    const { dryRun = false, clearOldField = false } = await request.json();

    // Initialize results early for quota error handling
    const results = {
      processed: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{
        contactId: string;
        email: string;
        action: "migrated" | "skipped" | "error";
        itemsCreated?: number;
        oldActionItems?: string;
        error?: string;
      }>,
    };

    // Use very conservative pagination to avoid quota issues
    // Firestore free tier: 50,000 reads/day, 20,000 writes/day
    const contactsRef = adminDb.collection(contactsPath(userId));
    const pageSize = 20; // Very small page size to reduce quota usage
    let lastDoc: QueryDocumentSnapshot | null = null;
    const allContacts: (Contact & { id: string })[] = [];
    let hasMore = true;
    let totalFetched = 0;
    const maxContactsToFetch = 200; // Limit total contacts to process in one run

    // Fetch contacts in pages with error handling for quota limits
    while (hasMore && totalFetched < maxContactsToFetch) {
      try {
        let query: Query = contactsRef.limit(pageSize);
        
        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const pageSnapshot = await query.get();
        
        if (pageSnapshot.empty) {
          hasMore = false;
          break;
        }

        const pageContacts = pageSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as (Contact & { id: string })[];

        // Filter to only contacts with actionItems field populated
        const contactsWithActionItems = pageContacts.filter((contact) => {
          const items = contact.actionItems;
          return items && String(items).trim().length > 0;
        });

        allContacts.push(...contactsWithActionItems);
        totalFetched += pageSnapshot.docs.length;
        lastDoc = pageSnapshot.docs[pageSnapshot.docs.length - 1];
        hasMore = pageSnapshot.docs.length === pageSize;

        // Longer delay between pages to avoid quota issues
        if (hasMore && totalFetched < maxContactsToFetch) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
        }
      } catch (error) {
        // Check if it's a quota error
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("Quota exceeded")) {
          return NextResponse.json({
            error: "Firestore quota exceeded",
            message: "You have hit your Firestore quota limit. Please wait a few hours for the quota to reset, or upgrade your Firebase plan.",
            processed: results.processed,
            migrated: results.migrated,
            skipped: results.skipped,
            errors: results.errors,
            quotaLimitReached: true,
            contactsProcessedSoFar: totalFetched,
            details: results.details,
          }, { status: 429 }); // 429 Too Many Requests
        }
        throw error; // Re-throw if it's not a quota error
      }
    }

    if (allContacts.length === 0 && totalFetched === 0) {
      return NextResponse.json({
        message: "No contacts found",
        processed: 0,
        migrated: 0,
        skipped: 0,
        errors: 0,
        details: [],
        summary: {
          totalContactsFetched: 0,
          contactsWithActionItemsField: 0,
          contactsWithNonEmptyActionItems: 0,
          contactsProcessed: 0,
        },
      });
    }

    const contacts = allContacts;

    // Process contacts in very small batches to avoid quota issues
    const batchSize = 5; // Reduced from 10 to 5
    const delayBetweenBatches = 500; // Increased to 500ms delay between batches
    
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      
      // Process batch
      for (const contact of batch) {
        results.processed++;

        try {
          // Debug: Log contact data to understand structure
          const hasActionItemsField = "actionItems" in contact;
          const actionItemsValue = contact.actionItems;
          const actionItemsType = typeof actionItemsValue;

          // Check if contact has old actionItems field
          if (!contact.actionItems) {
            results.skipped++;
            results.details.push({
              contactId: contact.id,
              email: contact.primaryEmail || "no email",
              action: "skipped",
              error: `No actionItems field (field exists: ${hasActionItemsField}, type: ${actionItemsType})`,
            });
            continue;
          }

          // Convert to string and check if it's empty
          const actionItemsText = String(contact.actionItems).trim();
          if (actionItemsText === "") {
            results.skipped++;
            results.details.push({
              contactId: contact.id,
              email: contact.primaryEmail || "no email",
              action: "skipped",
              error: "Action items field is empty or whitespace",
            });
            continue;
          }

          // Check if action items already exist in subcollection
          // Skip this check in dry run mode to reduce quota usage
          if (!dryRun) {
            try {
              const existingActionItemsRef = adminDb
                .collection(`users/${userId}/contacts/${contact.id}/actionItems`);
              const existingSnapshot = await existingActionItemsRef.limit(1).get();

              if (!existingSnapshot.empty) {
                results.skipped++;
                results.details.push({
                  contactId: contact.id,
                  email: contact.primaryEmail || "no email",
                  action: "skipped",
                  oldActionItems: actionItemsText.substring(0, 100),
                  error: "Action items already exist in subcollection",
                });
                continue;
              }
            } catch (checkError) {
              // If we can't check, log but continue (might be permission issue)
              console.warn(`Could not check existing action items for ${contact.id}:`, checkError);
            }
          }

          // Migrate action items
          if (!dryRun) {
            const createdIds = await importActionItemsFromText(
              userId,
              contact.id,
              actionItemsText
            );

            // Optionally clear the old field
            if (clearOldField) {
              const contactRef = adminDb.collection(contactsPath(userId)).doc(contact.id);
              await contactRef.update({
                actionItems: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
              });
            }

            results.migrated++;
            results.details.push({
              contactId: contact.id,
              email: contact.primaryEmail || "no email",
              action: "migrated",
              itemsCreated: createdIds.length,
              oldActionItems: actionItemsText.substring(0, 200),
            });
          } else {
            // Dry run: just count what would be migrated
            const items = actionItemsText
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line.length > 0);

            if (items.length === 0) {
              results.skipped++;
              results.details.push({
                contactId: contact.id,
                email: contact.primaryEmail || "no email",
                action: "skipped",
                oldActionItems: actionItemsText.substring(0, 100),
                error: "No valid action items found after parsing (empty lines only)",
              });
              continue;
            }

            results.migrated++;
            results.details.push({
              contactId: contact.id,
              email: contact.primaryEmail || "no email",
              action: "migrated",
              itemsCreated: items.length,
              oldActionItems: actionItemsText.substring(0, 200),
            });
          }
        } catch (error) {
          results.errors++;
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          const errorStack = error instanceof Error ? error.stack : undefined;
          console.error(`Error processing contact ${contact.id}:`, error);
          results.details.push({
            contactId: contact.id,
            email: contact.primaryEmail || "no email",
            action: "error",
            error: `${errorMessage}${errorStack ? ` (${errorStack.substring(0, 100)})` : ""}`,
          });
        }
      }
      
      // Add delay between batches to avoid quota issues (except for last batch)
      if (i + batchSize < contacts.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    // Add summary for debugging
    const summary = {
      totalContactsFetched: totalFetched,
      contactsWithActionItemsField: contacts.length, // Already filtered
      contactsWithNonEmptyActionItems: contacts.length,
      contactsProcessed: contacts.length,
    };

    return NextResponse.json({
      message: dryRun ? "Dry run completed" : "Migration completed",
      dryRun,
      clearOldField,
      summary,
      ...results,
    });
  } catch (error) {
    console.error("Error migrating action items:", error);
    return NextResponse.json(
      {
        error: "Failed to migrate action items",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

