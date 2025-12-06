import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAccessToken } from "@/lib/gmail/get-access-token";
import { normalizeMessage } from "@/lib/gmail/normalize-message";
import { findContactIdByEmail } from "@/lib/gmail/find-contact-id";
import { getUserId } from "@/lib/auth-utils";

// Fetch first 100 threads for initial sync
const THREADS_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=100";

export async function GET() {
  try {
    const userId = await getUserId();
    // Step 1 — Get access token
    const accessToken = await getAccessToken(userId);

    // Step 2 — Fetch thread IDs
    const threadsRes = await fetch(THREADS_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const threadsJson = await threadsRes.json();
    const threads = threadsJson.threads || [];
    const userThreadCol = adminDb
      .collection("users")
      .doc(userId)
      .collection("threads");

    let processedThreads = 0;
    let processedMessages = 0;

    // Step 3 — Loop through each thread
    for (const t of threads) {
      const threadId = t.id;

      // Fetch full thread details
      const fullRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const fullThread = await fullRes.json();
      const messages = fullThread.messages || [];

      // Save thread metadata
      await userThreadCol.doc(threadId).set(
        {
          threadId,
          historyId: fullThread.historyId,
          messageCount: messages.length,
          snippet: fullThread.snippet || "",
          syncedAt: Date.now(),
          needsSummary: true, // Gemini should summarize
        },
        { merge: true }
      );

      // Step 4 — Process each message
      for (const msg of messages) {
        const normalized = normalizeMessage(msg);
        processedMessages++;

        // Store message
        await userThreadCol
          .doc(threadId)
          .collection("messages")
          .doc(normalized.id)
          .set(normalized, { merge: true });

        // Step 5 — Link to CRM contacts
        const contactId = await findContactIdByEmail(
          adminDb,
          userId,
          normalized.from
        );

        if (contactId) {
          // Mark thread as linked to this contact
          await userThreadCol.doc(threadId).set(
            {
              contactId,
            },
            { merge: true }
          );

          // Step 6 — Update contact metadata
          await adminDb
            .collection("users")
            .doc(userId)
            .collection("contacts")
            .doc(contactId)
            .set(
              {
                lastEmailDate: normalized.date || normalized.internalDate,
                updatedAt: Date.now(),
              },
              { merge: true }
            );
        }
      }

      processedThreads++;
    }

    return NextResponse.json({
      ok: true,
      threadsProcessed: processedThreads,
      messagesProcessed: processedMessages,
    });
  } catch (err) {
    console.error("SYNC ERROR:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
