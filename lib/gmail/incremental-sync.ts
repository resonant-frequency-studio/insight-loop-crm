import { Firestore } from "firebase-admin/firestore";
import { getAccessToken } from "./get-access-token";
import { normalizeMessage } from "./normalize-message";
import { findContactIdByEmail } from "./find-contact-id";

export interface SyncResult {
  processedThreads: number;
  processedMessages: number;
  newHistoryId: string | null;
  errors: string[];
}

interface UserSyncSettings {
  lastSyncHistoryId?: string | null;
  lastSyncTimestamp?: number | null;
}

const MAX_DAYS_FOR_INCREMENTAL = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Get user's sync settings from Firestore
 */
export async function getUserSyncSettings(
  db: Firestore,
  userId: string
): Promise<UserSyncSettings> {
  const settingsDoc = await db
    .collection("users")
    .doc(userId)
    .collection("settings")
    .doc("sync")
    .get();

  if (!settingsDoc.exists) {
    return {};
  }

  const data = settingsDoc.data();
  return {
    lastSyncHistoryId: data?.lastSyncHistoryId || null,
    lastSyncTimestamp: data?.lastSyncTimestamp || null,
  };
}

/**
 * Update user's sync settings in Firestore
 */
export async function updateUserSyncSettings(
  db: Firestore,
  userId: string,
  historyId: string,
  timestamp: number
): Promise<void> {
  await db
    .collection("users")
    .doc(userId)
    .collection("settings")
    .doc("sync")
    .set(
      {
        lastSyncHistoryId: historyId,
        lastSyncTimestamp: timestamp,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
}

/**
 * Determine if we should do incremental or full sync
 */
export function shouldDoIncrementalSync(
  lastSyncTimestamp: number | null
): boolean {
  if (!lastSyncTimestamp) return false;

  const daysSinceLastSync =
    (Date.now() - lastSyncTimestamp) / MS_PER_DAY;
  return daysSinceLastSync <= MAX_DAYS_FOR_INCREMENTAL;
}

/**
 * Perform incremental sync using Gmail History API
 */
export async function performIncrementalSync(
  db: Firestore,
  userId: string,
  accessToken: string,
  lastHistoryId: string
): Promise<SyncResult> {
  const result: SyncResult = {
    processedThreads: 0,
    processedMessages: 0,
    newHistoryId: null,
    errors: [],
  };

  try {
    // Fetch history since lastHistoryId
    const historyRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${lastHistoryId}&historyTypes=messageAdded`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!historyRes.ok) {
      const errorData = await historyRes.json().catch(() => ({}));
      throw new Error(
        `History API error: ${errorData.error?.message || historyRes.statusText}`
      );
    }

    const historyData = await historyRes.json();
    const history = historyData.history || [];
    result.newHistoryId = historyData.historyId || lastHistoryId;

    const processedThreadIds = new Set<string>();

    // Process each history entry
    for (const entry of history) {
      const messagesAdded = entry.messagesAdded || [];
      
      for (const msgAdded of messagesAdded) {
        const message = msgAdded.message;
        if (!message) continue;

        const threadId = message.threadId;
        processedThreadIds.add(threadId);

        try {
          // Fetch full message details
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (!msgRes.ok) continue;

          const msgData = await msgRes.json();
          const normalized = normalizeMessage(msgData);
          result.processedMessages++;

          // Get thread to update contact metadata
          const threadDoc = await db
            .collection("users")
            .doc(userId)
            .collection("threads")
            .doc(threadId)
            .get();

          const threadData = threadDoc.exists
            ? (threadDoc.data() as { contactId?: string; historyId?: string })
            : null;

          // Store message in Firestore format
          const messageDoc = {
            messageId: normalized.id,
            gmailMessageId: normalized.id,
            from: normalized.from,
            to: normalized.to.split(",").map((e) => e.trim()).filter(Boolean),
            cc: [],
            sentAt: normalized.internalDate
              ? new Date(normalized.internalDate).toISOString()
              : normalized.date || new Date().toISOString(),
            bodyPlain: normalized.body || null,
            bodyHtml: null,
            isFromUser: false, // Will be determined later if needed
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await db
            .collection("users")
            .doc(userId)
            .collection("threads")
            .doc(threadId)
            .collection("messages")
            .doc(normalized.id)
            .set(messageDoc, { merge: true });

          // Update thread metadata
          const messageDate = normalized.internalDate
            ? new Date(normalized.internalDate)
            : normalized.date
            ? new Date(normalized.date)
            : new Date();

          await db
            .collection("users")
            .doc(userId)
            .collection("threads")
            .doc(threadId)
            .set(
              {
                threadId,
                gmailThreadId: threadId,
                historyId: msgData.historyId || threadData?.historyId,
                lastMessageAt: messageDate.toISOString(),
                updatedAt: Date.now(),
              },
              { merge: true }
            );

          // Link to contact if not already linked
          if (!threadData?.contactId) {
            const contactId = await findContactIdByEmail(
              db,
              userId,
              normalized.from
            );

            if (contactId) {
              await db
                .collection("users")
                .doc(userId)
                .collection("threads")
                .doc(threadId)
                .set({ contactId }, { merge: true });

              // Update contact metadata
              const emailDate = normalized.internalDate
                ? new Date(normalized.internalDate)
                : normalized.date
                ? new Date(normalized.date)
                : new Date();

              await db
                .collection("users")
                .doc(userId)
                .collection("contacts")
                .doc(contactId)
                .set(
                  {
                    lastEmailDate: emailDate.toISOString(),
                    updatedAt: Date.now(),
                  },
                  { merge: true }
                );
            }
          } else {
            // Update contact lastEmailDate if already linked
            const emailDate = normalized.internalDate
              ? new Date(normalized.internalDate)
              : normalized.date
              ? new Date(normalized.date)
              : new Date();

            await db
              .collection("users")
              .doc(userId)
              .collection("contacts")
              .doc(threadData.contactId)
              .set(
                {
                  lastEmailDate: emailDate.toISOString(),
                  updatedAt: Date.now(),
                },
                { merge: true }
              );
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          result.errors.push(`Error processing message ${message.id}: ${errorMsg}`);
        }
      }
    }

    result.processedThreads = processedThreadIds.size;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Incremental sync error: ${errorMsg}`);
    throw error;
  }

  return result;
}

/**
 * Perform full sync (fallback when incremental not possible)
 */
export async function performFullSync(
  db: Firestore,
  userId: string,
  accessToken: string,
  maxResults: number = 100
): Promise<SyncResult> {
  const result: SyncResult = {
    processedThreads: 0,
    processedMessages: 0,
    newHistoryId: null,
    errors: [],
  };

  try {
    // Fetch recent threads
    const threadsRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${maxResults}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!threadsRes.ok) {
      throw new Error(`Failed to fetch threads: ${threadsRes.statusText}`);
    }

    const threadsData = await threadsRes.json();
    const threads = threadsData.threads || [];

    let latestHistoryId: string | null = null;

    // Process each thread
    for (const thread of threads) {
      const threadId = thread.id;

      try {
        // Fetch full thread details
        const fullRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!fullRes.ok) continue;

        const fullThread = await fullRes.json();
        const messages = fullThread.messages || [];

        if (fullThread.historyId) {
          latestHistoryId = fullThread.historyId;
        }

        // Save thread metadata
        await db
          .collection("users")
          .doc(userId)
          .collection("threads")
          .doc(threadId)
          .set(
            {
              threadId,
              gmailThreadId: threadId,
              historyId: fullThread.historyId,
              snippet: fullThread.snippet || "",
              syncedAt: Date.now(),
              needsSummary: true,
              updatedAt: Date.now(),
            },
            { merge: true }
          );

        // Process each message
        for (const msg of messages) {
          const normalized = normalizeMessage(msg);
          result.processedMessages++;

          // Store message in Firestore format
          const messageDoc = {
            messageId: normalized.id,
            gmailMessageId: normalized.id,
            from: normalized.from,
            to: normalized.to.split(",").map((e) => e.trim()).filter(Boolean),
            cc: [],
            sentAt: normalized.internalDate
              ? new Date(normalized.internalDate).toISOString()
              : normalized.date || new Date().toISOString(),
            bodyPlain: normalized.body || null,
            bodyHtml: null,
            isFromUser: false, // Will be determined later if needed
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await db
            .collection("users")
            .doc(userId)
            .collection("threads")
            .doc(threadId)
            .collection("messages")
            .doc(normalized.id)
            .set(messageDoc, { merge: true });

          // Link to CRM contacts
          const contactId = await findContactIdByEmail(
            db,
            userId,
            normalized.from
          );

          if (contactId) {
            await db
              .collection("users")
              .doc(userId)
              .collection("threads")
              .doc(threadId)
              .set({ contactId }, { merge: true });

            // Update contact metadata
            const emailDate = normalized.internalDate
              ? new Date(normalized.internalDate)
              : normalized.date
              ? new Date(normalized.date)
              : new Date();

            await db
              .collection("users")
              .doc(userId)
              .collection("contacts")
              .doc(contactId)
              .set(
                {
                  lastEmailDate: emailDate.toISOString(),
                  updatedAt: Date.now(),
                },
                { merge: true }
              );
          }
        }

        result.processedThreads++;
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Error processing thread ${threadId}: ${errorMsg}`);
      }
    }

    result.newHistoryId = latestHistoryId;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Full sync error: ${errorMsg}`);
    throw error;
  }

  return result;
}

