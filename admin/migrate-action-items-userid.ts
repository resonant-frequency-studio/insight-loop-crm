#!/usr/bin/env node

/**
 * Migration Script: Backfill userId field for action items
 * 
 * This script adds the userId field to all existing action items that are missing it.
 * This is required for the collection group query optimization to work properly.
 * 
 * Usage:
 *   npx tsx admin/migrate-action-items-userid.ts [userId] [--dry-run] [--limit=100]
 * 
 * Or with ts-node:
 *   npx ts-node admin/migrate-action-items-userid.ts [userId] [--dry-run] [--limit=100]
 * 
 * Examples:
 *   # Dry run for a specific user
 *   npx tsx admin/migrate-action-items-userid.ts user123 --dry-run
 * 
 *   # Run migration for a specific user (limit 100 contacts)
 *   npx tsx admin/migrate-action-items-userid.ts user123 --limit=100
 * 
 *   # Run migration (using npm script)
 *   npm run migrate:action-items-userid <userId> [--dry-run] [--limit=100]
 */

// Load environment variables from .env.local FIRST, before any other imports
import { config } from "dotenv";
config({ path: ".env.local" });

import * as admin from "firebase-admin";
import { contactsPath } from "../lib/firestore-paths";

// Define actionItemsPath locally to avoid importing firebase-admin through lib/action-items
const actionItemsPath = (userId: string, contactId: string) =>
  `users/${userId}/contacts/${contactId}/actionItems`;

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };

  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    console.error("Error: Firebase Admin environment variables are not set.");
    console.error("Required: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY");
    process.exit(1);
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
  } catch (error) {
    // App might already be initialized
    if (!admin.apps.length) {
      throw error;
    }
  }
}

const db = admin.firestore();

type MigrationDetail = {
  userId: string;
  contactId: string;
  actionItemId: string;
  action: "updated" | "skipped" | "error";
  error?: string;
};

interface MigrationResults {
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
  details: Array<MigrationDetail>;
}

async function migrateActionItemsForUser(
  userId: string,
  dryRun: boolean = false,
  limit: number = 10000,
  batchSize: number = 50
): Promise<MigrationResults> {
  const results: MigrationResults = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  console.log(`\n📋 Processing user: ${userId}`);
  console.log(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`   Contact limit: ${limit === 10000 ? "unlimited" : limit}`);
  console.log(`   Batch size: ${batchSize} contacts\n`);

  // Get all contacts for this user (with pagination if limit is set)
  let contactsProcessed = 0;
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  let hasMore = true;

  while (hasMore && (limit === 10000 || contactsProcessed < limit)) {
    let query: admin.firestore.Query = db.collection(contactsPath(userId));
    
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    
    if (limit !== 10000) {
      const remaining = limit - contactsProcessed;
      query = query.limit(Math.min(batchSize, remaining));
    } else {
      query = query.limit(batchSize);
    }

    const contactsSnapshot = await query.get();

    if (contactsSnapshot.empty) {
      hasMore = false;
      break;
    }

    const contacts = contactsSnapshot.docs;
    const totalContacts = contactsProcessed + contacts.length;
    
    console.log(`   Processing batch: ${contactsProcessed + 1}-${totalContacts} contacts...`);

    // Process contacts in parallel batches to speed things up
    const contactPromises = contacts.map(async (contactDoc) => {
      const contactId = contactDoc.id;
      const actionItemsRef = db.collection(actionItemsPath(userId, contactId));

      try {
        const actionItemsSnapshot = await actionItemsRef.get();

        if (actionItemsSnapshot.empty) {
          return { processed: 0, updated: 0, skipped: 0, errors: 0, details: [] };
        }

        const contactResults = {
          processed: 0,
          updated: 0,
          skipped: 0,
          errors: 0,
          details: [] as typeof results.details,
        };

        // Process action items in batches for this contact
        const updatePromises = actionItemsSnapshot.docs.map(async (actionItemDoc) => {
          contactResults.processed++;
          const data = actionItemDoc.data();
          const actionItemId = actionItemDoc.id;

          // Check if userId is missing or incorrect
          if (!data.userId || data.userId !== userId) {
            if (dryRun) {
              contactResults.skipped++;
              contactResults.details.push({
                userId,
                contactId,
                actionItemId,
                action: "skipped",
              });
            } else {
              try {
                await actionItemDoc.ref.update({
                  userId,
                });
                contactResults.updated++;
                contactResults.details.push({
                  userId,
                  contactId,
                  actionItemId,
                  action: "updated",
                });
              } catch (error) {
                contactResults.errors++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                contactResults.details.push({
                  userId,
                  contactId,
                  actionItemId,
                  action: "error",
                  error: errorMessage,
                });
              }
            }
          } else {
            contactResults.skipped++;
          }
        });

        await Promise.all(updatePromises);
        return contactResults;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorDetail: MigrationDetail = {
          userId,
          contactId,
          actionItemId: "unknown",
          action: "error",
          error: `Contact processing error: ${errorMessage}`,
        };
        return {
          processed: 0,
          updated: 0,
          skipped: 0,
          errors: 1,
          details: [errorDetail],
        };
      }
    });

    const batchResults = await Promise.all(contactPromises);
    
    // Aggregate batch results
    batchResults.forEach((contactResult) => {
      results.processed += contactResult.processed;
      results.updated += contactResult.updated;
      results.skipped += contactResult.skipped;
      results.errors += contactResult.errors;
      results.details.push(...contactResult.details);
    });

    contactsProcessed = totalContacts;
    lastDoc = contacts[contacts.length - 1];
    hasMore = contacts.length === batchSize;

    // Progress update
    if (results.updated > 0 || results.processed > 0) {
      console.log(`   Progress: ${contactsProcessed} contacts, ${results.processed} action items processed, ${results.updated} updated`);
    }
  }

  if (contactsProcessed === 0) {
    console.log("   No contacts found for this user.");
  } else {
    console.log(`\n   Completed: ${contactsProcessed} contacts processed`);
  }

  return results;
}


function printSummary(results: MigrationResults, dryRun: boolean): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 MIGRATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`Processed: ${results.processed} action items`);
  console.log(`Updated:   ${results.updated} action items`);
  console.log(`Skipped:   ${results.skipped} action items (already had userId)`);
  console.log(`Errors:    ${results.errors} action items`);
  console.log("=".repeat(60));

  if (dryRun) {
    console.log("\n⚠️  This was a DRY RUN. No changes were made.");
    console.log("   Run without --dry-run to apply changes.\n");
  } else {
    console.log("\n✅ Migration completed!\n");
  }

  if (results.errors > 0) {
    console.log("⚠️  Some errors occurred. Check the details above.\n");
  }
}

async function main() {
  const args = process.argv.slice(2);
  let userId: string | null = null;
  let dryRun = false;
  let limit = 10000; // Default to unlimited (10000 is used as "unlimited" flag)
  let batchSize = 50;

  // Parse arguments
  for (const arg of args) {
    if (arg === "--dry-run" || arg === "--dryrun") {
      dryRun = true;
    } else if (arg.startsWith("--limit=")) {
      const limitValue = parseInt(arg.split("=")[1], 10);
      limit = limitValue > 0 ? limitValue : 10000;
    } else if (arg.startsWith("--batch-size=")) {
      batchSize = parseInt(arg.split("=")[1], 10) || 50;
    } else if (!arg.startsWith("--")) {
      userId = arg;
    }
  }

  try {
    if (!userId) {
      console.error("Error: Please provide a userId");
      console.error("\nUsage:");
      console.error("  npx tsx admin/migrate-action-items-userid.ts <userId> [--dry-run] [--limit=N] [--batch-size=N]");
      console.error("  npm run migrate:action-items-userid <userId> [--dry-run] [--limit=N] [--batch-size=N]");
      console.error("\nOptions:");
      console.error("  --dry-run        Preview changes without applying them");
      console.error("  --limit=N        Maximum number of contacts to process (default: unlimited)");
      console.error("  --batch-size=N   Number of contacts to process per batch (default: 50)");
      console.error("\nExamples:");
      console.error("  npx tsx admin/migrate-action-items-userid.ts user123 --dry-run");
      console.error("  npx tsx admin/migrate-action-items-userid.ts user123 --batch-size=100");
      console.error("  npx tsx admin/migrate-action-items-userid.ts user123 --limit=500 --batch-size=25");
      console.error("  npm run migrate:action-items-userid user123 --dry-run");
      console.error("\nNote: You can find your userId in the browser console or Firebase Auth.");
      process.exit(1);
    }

    const results = await migrateActionItemsForUser(userId, dryRun, limit, batchSize);
    printSummary(results, dryRun);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    if (error instanceof Error) {
      console.error("   Error:", error.message);
      console.error("   Stack:", error.stack);
    }
    process.exit(1);
  } finally {
    // Cleanup - only delete if we initialized
    if (admin.apps.length > 0) {
      try {
        await admin.app().delete();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// Run the script
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

