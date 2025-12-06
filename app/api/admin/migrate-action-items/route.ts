import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { contactsPath } from "@/lib/firestore-paths";
import { importActionItemsFromText } from "@/lib/action-items";
import { Contact } from "@/types/firestore";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/admin/migrate-action-items
 * Migrate action items from old string field to new subcollection format
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    const { dryRun = false, clearOldField = false } = await request.json();

    // Get all contacts
    const contactsRef = adminDb.collection(contactsPath(userId));
    const contactsSnapshot = await contactsRef.get();

    if (contactsSnapshot.empty) {
      return NextResponse.json({
        message: "No contacts found",
        processed: 0,
        migrated: 0,
        skipped: 0,
        errors: 0,
        details: [],
      });
    }

    const contacts = contactsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as (Contact & { id: string })[];

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

    // Process contacts
    for (const contact of contacts) {
      results.processed++;

      try {
        // Check if contact has old actionItems field
        if (!contact.actionItems || contact.actionItems.trim() === "") {
          results.skipped++;
          results.details.push({
            contactId: contact.id,
            email: contact.primaryEmail || "no email",
            action: "skipped",
            error: "No action items to migrate",
          });
          continue;
        }

        // Check if action items already exist in subcollection
        const existingActionItemsRef = adminDb
          .collection(`users/${userId}/contacts/${contact.id}/actionItems`);
        const existingSnapshot = await existingActionItemsRef.limit(1).get();

        if (!existingSnapshot.empty) {
          results.skipped++;
          results.details.push({
            contactId: contact.id,
            email: contact.primaryEmail || "no email",
            action: "skipped",
            oldActionItems: contact.actionItems,
            error: "Action items already exist in subcollection",
          });
          continue;
        }

        // Migrate action items
        if (!dryRun) {
          const createdIds = await importActionItemsFromText(
            userId,
            contact.id,
            contact.actionItems
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
            oldActionItems: contact.actionItems,
          });
        } else {
          // Dry run: just count what would be migrated
          const items = contact.actionItems
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

          results.migrated++;
          results.details.push({
            contactId: contact.id,
            email: contact.primaryEmail || "no email",
            action: "migrated",
            itemsCreated: items.length,
            oldActionItems: contact.actionItems,
          });
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          contactId: contact.id,
          email: contact.primaryEmail || "no email",
          action: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: dryRun ? "Dry run completed" : "Migration completed",
      dryRun,
      clearOldField,
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

