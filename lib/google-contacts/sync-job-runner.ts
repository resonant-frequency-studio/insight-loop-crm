import { adminDb } from "@/lib/firebase-admin";
import { getAccessToken } from "@/lib/gmail/get-access-token";
import { importContactsFromGoogle } from "./import-contacts";
import { syncContactThreads } from "@/lib/gmail/sync-contact-threads";
import { summarizeContactThreads } from "@/lib/gmail/summarize-contact-threads";
import { generateContactInsights } from "@/lib/gmail/generate-contact-insights";
import { SyncJob } from "@/types/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { reportException, ErrorLevel } from "@/lib/error-reporting";
import { getUserEmail } from "@/lib/auth-utils";
import { ensureOwnerTag } from "@/lib/contacts/owner-utils";
import { normalizeContactId } from "@/util/csv-utils";
import { Contact } from "@/types/firestore";

export interface ContactsSyncJobOptions {
  userId: string;
  syncJobId?: string;
}

export interface ContactsSyncJobResult {
  success: boolean;
  syncJobId: string;
  processedContacts: number;
  skippedContacts: number;
  insightsGenerated?: number;
  errorMessage?: string;
  errors?: string[];
}

/**
 * Create a new contacts sync job document
 */
async function createSyncJob(
  userId: string,
  syncJobId: string
): Promise<void> {
  await adminDb
    .collection("users")
    .doc(userId)
    .collection("syncJobs")
    .doc(syncJobId)
    .set({
      syncJobId,
      userId,
      service: "contacts",
      type: "initial", // Contacts sync is always full sync
      status: "running",
      startedAt: FieldValue.serverTimestamp(),
      processedContacts: 0,
      skippedContacts: 0,
    });
}

/**
 * Update sync job status
 * Uses set with merge to handle cases where document might not exist yet
 */
async function updateSyncJob(
  userId: string,
  syncJobId: string,
  updates: Partial<SyncJob>
): Promise<void> {
  // Filter out undefined values - Firestore doesn't allow undefined
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined)
  );

  const docRef = adminDb
    .collection("users")
    .doc(userId)
    .collection("syncJobs")
    .doc(syncJobId);

  // Use set with merge instead of update to handle cases where document doesn't exist
  // This ensures we can update the job even if creation failed or was interrupted
  await docRef.set(
    {
      syncJobId,
      userId,
      ...cleanUpdates,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Check if a contacts sync is already running for this user
 */
async function isSyncRunning(userId: string): Promise<boolean> {
  const runningSyncs = await adminDb
    .collection("users")
    .doc(userId)
    .collection("syncJobs")
    .where("status", "==", "running")
    .where("service", "==", "contacts")
    .limit(1)
    .get();

  return !runningSyncs.empty;
}

/**
 * Main contacts sync job runner
 */
export async function runContactsSyncJob(
  options: ContactsSyncJobOptions
): Promise<ContactsSyncJobResult> {
  const { userId, syncJobId } = options;
  const jobId = syncJobId || `contacts_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let syncJobCreated = false;

  try {
    // Check if sync is already running
    if (await isSyncRunning(userId)) {
      return {
        success: false,
        syncJobId: jobId,
        processedContacts: 0,
        skippedContacts: 0,
        errorMessage: "A contacts sync job is already running for this user",
      };
    }

    // Get access token first (may throw if token is expired/revoked)
    // This validates we can proceed before creating the sync job
    const accessToken = await getAccessToken(userId);

    // Create sync job document after validation passes
    await createSyncJob(userId, jobId);
    syncJobCreated = true;

    // Update status to importing
    await updateSyncJob(userId, jobId, {
      currentStep: "importing",
    });

    // Import contacts from Google with progress tracking
    const importResults = await importContactsFromGoogle(
      userId,
      accessToken,
      10, // batchSize
      async (progress) => {
        // Update sync job with import progress
        await updateSyncJob(userId, jobId, {
          processedContacts: progress.imported,
          skippedContacts: progress.skipped,
          totalContacts: progress.total,
          currentStep: "importing",
        });
      }
    );

    // Update sync job after import completes
    await updateSyncJob(userId, jobId, {
      processedContacts: importResults.imported,
      skippedContacts: importResults.skipped,
      totalContacts: importResults.total,
    });

    // Ensure owner contact exists - create if it doesn't
    try {
      const userEmail = await getUserEmail();
      if (userEmail) {
        const ownerContactId = normalizeContactId(userEmail);
        const ownerContactDoc = await adminDb
          .collection("users")
          .doc(userId)
          .collection("contacts")
          .doc(ownerContactId)
          .get();

        if (!ownerContactDoc.exists) {
          // Create owner contact
          const ownerContactData = ensureOwnerTag(
            {
              contactId: ownerContactId,
              primaryEmail: userEmail.toLowerCase(),
              tags: [],
            },
            userEmail
          );

          await adminDb
            .collection("users")
            .doc(userId)
            .collection("contacts")
            .doc(ownerContactId)
            .set({
              ...ownerContactData,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
        } else {
          // Ensure Owner tag is present on existing contact
          const existingData = ownerContactDoc.data() as Contact;
          const updatedContact = ensureOwnerTag(existingData, userEmail);
          if (updatedContact.tags && JSON.stringify(updatedContact.tags) !== JSON.stringify(existingData.tags)) {
            await adminDb
              .collection("users")
              .doc(userId)
              .collection("contacts")
              .doc(ownerContactId)
              .update({
                tags: updatedContact.tags,
                updatedAt: FieldValue.serverTimestamp(),
              });
          }
        }
      }
    } catch (error) {
      // Log but don't fail the sync if owner contact creation fails
      reportException(error, {
        context: "Error ensuring owner contact exists during contacts sync",
        tags: { component: "contacts-sync-job-runner", userId },
        level: ErrorLevel.WARNING,
      });
    }

    // If contacts were imported, sync Gmail threads and generate insights for each
    let insightsGenerated = 0;
    if (importResults.imported > 0 && importResults.importedContactIds.length > 0) {
      // Update status to syncing Gmail
      await updateSyncJob(userId, jobId, {
        currentStep: "syncing_gmail",
      });

      // Process imported contacts in batches to avoid overwhelming the system
      const insightsBatchSize = 5; // Process 5 contacts at a time for Gmail sync and insights
      const totalContactsToProcess = importResults.importedContactIds.length;
      
      for (let i = 0; i < importResults.importedContactIds.length; i += insightsBatchSize) {
        const batch = importResults.importedContactIds.slice(i, i + insightsBatchSize);
        
        await Promise.all(
          batch.map(async ({ contactId, email }) => {
            try {
              // Step 1: Sync Gmail threads for this contact
              const syncResult = await syncContactThreads(
                adminDb,
                userId,
                email,
                contactId,
                accessToken,
                50 // Limit to 50 threads per contact initially to avoid rate limits
              );
              
              // Step 2: Summarize threads (only if threads were found)
              if (syncResult.processedThreads > 0) {
                await summarizeContactThreads(adminDb, userId, contactId, 5); // Process up to 5 threads
              }
              
              // Step 3: Generate contact insights (this will also calculate engagement score)
              const insightsResult = await generateContactInsights(adminDb, userId, contactId);
              
              if (insightsResult.hasInsights) {
                insightsGenerated++;
              }
            } catch (error) {
              // Log but don't fail the entire import - insights generation is best-effort
              reportException(error, {
                context: "Error syncing Gmail/insights for imported contact",
                tags: { component: "contacts-sync-job-runner", userId, contactId },
                level: ErrorLevel.WARNING,
              });
            }
          })
        );
        
        // Update progress after each batch
        const contactsProcessed = Math.min(i + insightsBatchSize, totalContactsToProcess);
        await updateSyncJob(userId, jobId, {
          processedContacts: importResults.imported, // Keep imported count
          currentStep: contactsProcessed < totalContactsToProcess ? "syncing_gmail" : "generating_insights",
        });
        
        // Small delay between batches to avoid overwhelming APIs
        if (i + insightsBatchSize < importResults.importedContactIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Update status to generating insights (if we're done with Gmail sync)
      if (importResults.importedContactIds.length > 0) {
        await updateSyncJob(userId, jobId, {
          currentStep: "generating_insights",
        });
      }
    }

    // Update sync job as complete
    await updateSyncJob(userId, jobId, {
      status: "complete",
      finishedAt: FieldValue.serverTimestamp(),
      processedContacts: importResults.imported,
      skippedContacts: importResults.skipped,
      totalContacts: importResults.total,
      currentStep: undefined, // Clear current step on completion
      errorMessage:
        importResults.errors > 0
          ? `${importResults.errors} contact(s) failed to import`
          : undefined,
    });

    return {
      success: true,
      syncJobId: jobId,
      processedContacts: importResults.imported,
      skippedContacts: importResults.skipped,
      insightsGenerated,
      errors:
        importResults.errorDetails.length > 0
          ? importResults.errorDetails
          : undefined,
    };
  } catch (error) {
    let errorMessage = "Unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Update sync job as error (or create it if it wasn't created yet)
    try {
      await updateSyncJob(userId, jobId, {
        syncJobId: jobId,
        userId,
        service: "contacts",
        type: "initial",
        status: "error",
        startedAt: syncJobCreated ? undefined : FieldValue.serverTimestamp(),
        finishedAt: FieldValue.serverTimestamp(),
        errorMessage,
        processedContacts: 0,
        skippedContacts: 0,
      });
    } catch (updateError) {
      reportException(updateError, {
        context: "Failed to update contacts sync job status",
        tags: { component: "contacts-sync-job-runner", userId, jobId },
      });
    }

    return {
      success: false,
      syncJobId: jobId,
      processedContacts: 0,
      skippedContacts: 0,
      errorMessage,
    };
  }
}

/**
 * Run contacts sync for all users (for scheduled jobs)
 */
export async function runContactsSyncForAllUsers(): Promise<
  Array<{ userId: string; result: ContactsSyncJobResult }>
> {
  const usersSnapshot = await adminDb
    .collection("googleAccounts")
    .get();

  const results: Array<{ userId: string; result: ContactsSyncJobResult }> = [];

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    try {
      const result = await runContactsSyncJob({ userId });
      results.push({ userId, result });
    } catch (error) {
      reportException(error, {
        context: "Failed to sync contacts for user",
        tags: { component: "contacts-sync-job-runner", userId },
      });
      results.push({
        userId,
        result: {
          success: false,
          syncJobId: `failed_${Date.now()}`,
          processedContacts: 0,
          skippedContacts: 0,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  return results;
}

