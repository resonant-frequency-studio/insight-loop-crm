import { Firestore } from "firebase-admin/firestore";
import { normalizeMessage } from "./normalize-message";
import { getUserEmail } from "@/lib/auth-utils";
import { ensureOwnerTag } from "@/lib/contacts/owner-utils";
import { Contact } from "@/types/firestore";

export interface ContactSyncResult {
  processedThreads: number;
  processedMessages: number;
  errors: string[];
}

/**
 * Sync Gmail threads for a specific contact by email address
 * Uses Gmail API query to filter threads by contact email
 * 
 * @param db - Firestore instance
 * @param userId - User ID
 * @param contactEmail - Contact's email address
 * @param contactId - Contact ID to link threads to
 * @param accessToken - Google OAuth access token
 * @param maxResults - Maximum number of threads to fetch (default: 500)
 * @returns Sync result with statistics
 */
export async function syncContactThreads(
  db: Firestore,
  userId: string,
  contactEmail: string,
  contactId: string,
  accessToken: string,
  maxResults: number = 500
): Promise<ContactSyncResult> {
  const result: ContactSyncResult = {
    processedThreads: 0,
    processedMessages: 0,
    errors: [],
  };

  if (!contactEmail || !contactEmail.includes("@")) {
    result.errors.push("Invalid contact email address");
    return result;
  }

  try {
    // Build Gmail API query to filter by contact email
    // Search for threads where contact is sender or recipient
    const query = `from:${contactEmail} OR to:${contactEmail}`;
    const encodedQuery = encodeURIComponent(query);

    // Fetch threads matching the contact's email
    const threadsRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodedQuery}&maxResults=${maxResults}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!threadsRes.ok) {
      const errorText = await threadsRes.text();
      throw new Error(
        `Failed to fetch threads: ${threadsRes.status} ${threadsRes.statusText} - ${errorText}`
      );
    }

    const threadsData = await threadsRes.json();
    const threads = threadsData.threads || [];

    if (threads.length === 0) {
      return result; // No threads found for this contact
    }

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

        if (!fullRes.ok) {
          result.errors.push(`Failed to fetch thread ${threadId}: ${fullRes.statusText}`);
          continue;
        }

        const fullThread = await fullRes.json();
        const messages = fullThread.messages || [];

        if (messages.length === 0) continue;

        // Extract subject from first message
        let threadSubject: string | null = null;
        if (messages.length > 0) {
          const firstMessage = normalizeMessage(messages[0]);
          threadSubject = firstMessage.subject || null;
        }

        // Save thread metadata and link to contact
        await db
          .collection("users")
          .doc(userId)
          .collection("threads")
          .doc(threadId)
          .set(
            {
              threadId,
              gmailThreadId: threadId,
              historyId: fullThread.historyId || null,
              snippet: fullThread.snippet || "",
              subject: threadSubject,
              contactId, // Link to the specific contact
              syncedAt: Date.now(),
              needsSummary: true, // Mark as needing summary
              updatedAt: Date.now(),
            },
            { merge: true }
          );

        // Process each message in the thread
        let latestMessageDate: Date | null = null;
        let firstMessageDate: Date | null = null;

        for (const msg of messages) {
          const normalized = normalizeMessage(msg);
          result.processedMessages++;

          const messageDate = normalized.internalDate
            ? new Date(normalized.internalDate)
            : normalized.date
            ? new Date(normalized.date)
            : new Date();

          if (!latestMessageDate || messageDate > latestMessageDate) {
            latestMessageDate = messageDate;
          }

          if (!firstMessageDate || messageDate < firstMessageDate) {
            firstMessageDate = messageDate;
          }

          // Store message in Firestore format
          const messageDoc = {
            messageId: normalized.id,
            gmailMessageId: normalized.id,
            from: normalized.from,
            to: normalized.to.split(",").map((e) => e.trim()).filter(Boolean),
            cc: [],
            sentAt: messageDate.toISOString(),
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
        }

        // Update thread with message dates
        if (latestMessageDate && firstMessageDate) {
          await db
            .collection("users")
            .doc(userId)
            .collection("threads")
            .doc(threadId)
            .set(
              {
                lastMessageAt: latestMessageDate.toISOString(),
                firstMessageAt: firstMessageDate.toISOString(),
              },
              { merge: true }
            );
        } else if (latestMessageDate) {
          await db
            .collection("users")
            .doc(userId)
            .collection("threads")
            .doc(threadId)
            .set(
              {
                lastMessageAt: latestMessageDate.toISOString(),
                firstMessageAt: latestMessageDate.toISOString(),
              },
              { merge: true }
            );
        }

        // Update contact metadata with latest email date
        if (latestMessageDate) {
          await db
            .collection("users")
            .doc(userId)
            .collection("contacts")
            .doc(contactId)
            .set(
              {
                lastEmailDate: latestMessageDate.toISOString(),
                updatedAt: Date.now(),
              },
              { merge: true }
            );
        }

        result.processedThreads++;
      } catch (error) {
        let errorMsg = "Failed to process email thread.";
        if (error instanceof Error) {
          // Use user-friendly error message if available
          if (error.message.includes("Gmail API") || error.message.includes("401") || error.message.includes("403")) {
            errorMsg = "Gmail access error. Please reconnect your Gmail account.";
          } else if (error.message.length < 100 && !error.message.includes("Error:")) {
            // If it's already user-friendly, use it
            errorMsg = error.message;
          }
        }
        result.errors.push(errorMsg);
      }
    }

    // Update contact thread count and ensure Owner tag if needed
    const threadCount = await db
      .collection("users")
      .doc(userId)
      .collection("threads")
      .where("contactId", "==", contactId)
      .get();

    // Get current contact to check for Owner tag
    const contactDoc = await db
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .get();

    const contactData = contactDoc.data() || {};
    const updateData: Partial<Contact> = {
      threadCount: threadCount.size,
      updatedAt: Date.now(),
    };

    // Ensure Owner tag is present if this is the owner contact
    try {
      const userEmail = await getUserEmail();
      const updatedContact = ensureOwnerTag(contactData as Partial<Contact>, userEmail);
      if (updatedContact.tags) {
        updateData.tags = updatedContact.tags;
      }
    } catch (error) {
      // If we can't get user email, continue without Owner tag update
      // This is non-critical
    }

    await db
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .set(updateData, { merge: true });
  } catch (error) {
    let errorMsg = "Failed to sync Gmail threads for this contact.";
    if (error instanceof Error) {
      if (error.message.includes("Gmail API") || error.message.includes("401") || error.message.includes("403")) {
        errorMsg = "Gmail access error. Please reconnect your Gmail account.";
      } else if (error.message.includes("access token") || error.message.includes("authentication")) {
        errorMsg = "Gmail authentication error. Please reconnect your Gmail account.";
      } else if (error.message.length < 100 && !error.message.includes("Error:")) {
        errorMsg = error.message;
      }
    }
    result.errors.push(errorMsg);
    throw error;
  }

  return result;
}

