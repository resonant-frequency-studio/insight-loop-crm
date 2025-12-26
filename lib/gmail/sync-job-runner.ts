import { adminDb } from "@/lib/firebase-admin";
import { getAccessToken } from "./get-access-token";
import {
  getUserSyncSettings,
  updateUserSyncSettings,
  shouldDoIncrementalSync,
  performIncrementalSync,
  performFullSync,
  type SyncResult,
} from "./incremental-sync";
import { SyncJob } from "@/types/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { reportException, ErrorLevel } from "@/lib/error-reporting";
import { getUserEmail } from "@/lib/auth-utils";
import { ensureOwnerTag } from "@/lib/contacts/owner-utils";
import { normalizeContactId } from "@/util/csv-utils";
import { Contact } from "@/types/firestore";

export interface SyncJobOptions {
  userId: string;
  type?: "initial" | "incremental" | "auto";
  syncJobId?: string;
}

export interface SyncJobResult {
  success: boolean;
  syncJobId: string;
  processedThreads: number;
  processedMessages: number;
  errorMessage?: string;
  errors?: string[];
}

/**
 * Create a new sync job document
 */
async function createSyncJob(
  userId: string,
  type: "initial" | "incremental",
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
      service: "gmail",
      type,
      status: "running",
      startedAt: FieldValue.serverTimestamp(),
      processedThreads: 0,
      processedMessages: 0,
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
    Object.entries(updates).filter(([_, value]) => value !== undefined)
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
 * Check if a sync is already running for this user
 */
async function isSyncRunning(userId: string): Promise<boolean> {
  const runningSyncs = await adminDb
    .collection("users")
    .doc(userId)
    .collection("syncJobs")
    .where("status", "==", "running")
    .limit(1)
    .get();

  return !runningSyncs.empty;
}

/**
 * Ensure owner contact exists - create if it doesn't, update Owner tag if it does
 */
async function ensureOwnerContactExists(userId: string): Promise<void> {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return;

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
  } catch (error) {
    // Log but don't fail the sync if owner contact creation fails
    reportException(error, {
      context: "Error ensuring owner contact exists during Gmail sync",
      tags: { component: "gmail-sync-job-runner", userId },
      level: ErrorLevel.WARNING,
    });
  }
}

/**
 * Main sync job runner - handles both incremental and full syncs
 */
export async function runSyncJob(
  options: SyncJobOptions
): Promise<SyncJobResult> {
  const { userId, type = "auto", syncJobId } = options;
  const jobId = syncJobId || `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let syncJobCreated = false;
  let syncType: "initial" | "incremental" = "initial";

  try {
    // Check if sync is already running
    if (await isSyncRunning(userId)) {
      return {
        success: false,
        syncJobId: jobId,
        processedThreads: 0,
        processedMessages: 0,
        errorMessage: "A sync job is already running for this user",
      };
    }

    // Get access token first (may throw if token is expired/revoked)
    // This validates we can proceed before creating the sync job
    const accessToken = await getAccessToken(userId);

    // Determine sync type
    if (type === "auto") {
      const settings = await getUserSyncSettings(adminDb, userId);
      syncType =
        settings.lastSyncHistoryId &&
        shouldDoIncrementalSync(settings.lastSyncTimestamp || null)
          ? "incremental"
          : "initial";
    } else {
      syncType = type;
    }

    // Create sync job document after validation passes
    await createSyncJob(userId, syncType, jobId);
    syncJobCreated = true;

    // Ensure owner contact exists before syncing
    await ensureOwnerContactExists(userId);

    // Get sync settings for incremental sync
    const settings = await getUserSyncSettings(adminDb, userId);
    let syncResult: SyncResult;

    // Perform sync
    if (syncType === "incremental" && settings.lastSyncHistoryId) {
      try {
        syncResult = await performIncrementalSync(
          adminDb,
          userId,
          accessToken,
          settings.lastSyncHistoryId
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // If it's an authentication scope issue, don't fall back - throw it so user can reconnect
        if (errorMessage.includes("insufficient authentication scopes") || 
            errorMessage.includes("insufficient authentication") ||
            errorMessage.includes("Gmail authentication scopes are insufficient") ||
            errorMessage.includes("reconnect your Gmail account")) {
          throw error;
        }
        
        // Fallback to full sync if incremental fails (e.g., historyId invalid)
        reportException(error, {
          context: "Incremental Gmail sync failed, falling back to full sync",
          tags: { component: "gmail-sync-job-runner", userId },
        });
        syncResult = await performFullSync(adminDb, userId, accessToken);
      }
    } else {
      syncResult = await performFullSync(adminDb, userId, accessToken);
    }

    // Update sync settings with new historyId
    if (syncResult.newHistoryId) {
      await updateUserSyncSettings(
        adminDb,
        userId,
        syncResult.newHistoryId,
        Date.now()
      );
    }

    // Update sync job as complete
    await updateSyncJob(userId, jobId, {
      status: "complete",
      finishedAt: FieldValue.serverTimestamp(),
      processedThreads: syncResult.processedThreads,
      processedMessages: syncResult.processedMessages,
      errorMessage:
        syncResult.errors.length > 0
          ? syncResult.errors.join("; ")
          : undefined,
    });

    return {
      success: true,
      syncJobId: jobId,
      processedThreads: syncResult.processedThreads,
      processedMessages: syncResult.processedMessages,
      errors: syncResult.errors.length > 0 ? syncResult.errors : undefined,
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
        service: "gmail",
        type: syncType || "initial",
        status: "error",
        startedAt: syncJobCreated ? undefined : FieldValue.serverTimestamp(),
        finishedAt: FieldValue.serverTimestamp(),
        errorMessage,
        processedThreads: 0,
        processedMessages: 0,
      });
    } catch (updateError) {
      reportException(updateError, {
        context: "Failed to update sync job status",
        tags: { component: "sync-job-runner", userId, jobId },
      });
    }

    return {
      success: false,
      syncJobId: jobId,
      processedThreads: 0,
      processedMessages: 0,
      errorMessage,
    };
  }
}

/**
 * Run sync for all users (for scheduled jobs)
 */
export async function runSyncForAllUsers(): Promise<
  Array<{ userId: string; result: SyncJobResult }>
> {
  const usersSnapshot = await adminDb
    .collection("googleAccounts")
    .get();

  const results: Array<{ userId: string; result: SyncJobResult }> = [];

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    try {
      const result = await runSyncJob({ userId, type: "auto" });
      results.push({ userId, result });
    } catch (error) {
      reportException(error, {
        context: "Failed to sync for user",
        tags: { component: "sync-job-runner", userId },
      });
      results.push({
        userId,
        result: {
          success: false,
          syncJobId: `failed_${Date.now()}`,
          processedThreads: 0,
          processedMessages: 0,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  return results;
}

