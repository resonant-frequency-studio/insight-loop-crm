import { Firestore } from "firebase-admin/firestore";
import { THREAD_SUMMARY_PROMPT } from "@/lib/gemini/prompts";
import { reportException } from "@/lib/error-reporting";
import { getUserEmail } from "@/lib/auth-utils";
import { isOwnerContact } from "@/lib/contacts/owner-utils";

interface ThreadSummary {
  summary: string;
  actionItems: string[];
  sentiment: string;
  relationshipInsights: string;
  painPoints: string[];
  coachingThemes: string[];
  nextTouchpointDate: string;
  nextTouchpointMessage: string;
  outreachDraft: string;
}

export interface SummarizeResult {
  summarized: number;
  errors: string[];
}

/**
 * Generate Gemini summaries for all threads belonging to a specific contact
 * Only processes threads that need summaries (needsSummary: true)
 * 
 * @param db - Firestore instance
 * @param userId - User ID
 * @param contactId - Contact ID
 * @param maxThreads - Maximum number of threads to process (default: 10, to avoid token limits)
 * @returns Summary result with statistics
 */
export async function summarizeContactThreads(
  db: Firestore,
  userId: string,
  contactId: string,
  maxThreads: number = 10
): Promise<SummarizeResult> {
  const result: SummarizeResult = {
    summarized: 0,
    errors: [],
  };

  try {
    // Check if this is the owner contact - skip summarization for owner
    const contactDoc = await db
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .get();

    if (contactDoc.exists) {
      const contactData = contactDoc.data();
      const userEmail = await getUserEmail();
      if (contactData?.primaryEmail && isOwnerContact(userEmail, contactData.primaryEmail)) {
        // Skip summarization for owner contacts
        return result;
      }
    }

    // Fetch threads for this contact that need summaries
    const threadsSnap = await db
      .collection("users")
      .doc(userId)
      .collection("threads")
      .where("contactId", "==", contactId)
      .where("needsSummary", "==", true)
      .limit(maxThreads)
      .get();

    if (threadsSnap.empty) {
      return result; // No threads need summarization
    }

    // Process each thread
    for (const threadDoc of threadsSnap.docs) {
      const threadId = threadDoc.id;

      try {
        // Load thread messages
        const msgsSnap = await db
          .collection("users")
          .doc(userId)
          .collection("threads")
          .doc(threadId)
          .collection("messages")
          .get();

        if (msgsSnap.empty) {
          // No messages, mark as summarized
          await db
            .collection("users")
            .doc(userId)
            .collection("threads")
            .doc(threadId)
            .update({
              needsSummary: false,
            });
          continue;
        }

        // Sort messages by date (if available)
        const messages = msgsSnap.docs.map((doc) => doc.data());
        messages.sort((a, b) => {
          const dateA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
          const dateB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
          return dateA - dateB;
        });

        // Get thread subject if available
        const threadData = threadDoc.data();
        const threadSubject = threadData?.subject || threadData?.snippet || "No Subject";

        // Build transcript
        const transcript = messages
          .map((m) => {
            const toAddresses = Array.isArray(m.to) ? m.to.join(", ") : m.to || "Unknown";
            return `From: ${m.from || "Unknown"}\nTo: ${toAddresses}\nDate: ${m.sentAt || "Unknown"}\nSubject: ${threadSubject}\n\n${m.bodyPlain || ""}`;
          })
          .join("\n\n---\n\n");

        // Call Gemini API to generate summary
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${process.env.GOOGLE_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: THREAD_SUMMARY_PROMPT(transcript) }] }],
            }),
          }
        );

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          throw new Error(
            `Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText} - ${errorText}`
          );
        }

        const geminiData = await geminiResponse.json();
        let text =
          geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

        // Strip markdown code blocks if present (Gemini sometimes wraps JSON in ```json ... ```)
        text = text.trim();
        if (text.startsWith("```")) {
          // Remove opening ```json or ```
          text = text.replace(/^```(?:json)?\n?/i, "");
          // Remove closing ```
          text = text.replace(/\n?```$/i, "");
          text = text.trim();
        }

        let parsed: ThreadSummary;
        try {
          parsed = JSON.parse(text);
        } catch (parseError) {
          const errorMessage = `Failed to parse AI response. The AI service returned an invalid format.`;
          reportException(parseError, {
            context: "Failed to parse Gemini JSON response",
            tags: { component: "summarize-contact-threads", contactId, threadId },
            extra: { rawText: text.substring(0, 500) },
          });
          throw new Error(errorMessage);
        }

        // Skip action items import - per user request, contact sync should not create action items

        // Store summary in thread document
        await db
          .collection("users")
          .doc(userId)
          .collection("threads")
          .doc(threadId)
          .update({
            summary: parsed,
            needsSummary: false,
            summarizedAt: Date.now(),
            updatedAt: Date.now(),
          });

        result.summarized++;
      } catch (error) {
        let errorMsg = "Failed to generate AI summary for this email thread.";
        if (error instanceof Error) {
          // Use user-friendly error message if available, otherwise generic
          if (error.message.includes("Failed to parse AI response")) {
            errorMsg = "AI service returned an invalid response format. Please try again.";
          } else if (error.message.includes("Gemini API error")) {
            errorMsg = "AI service temporarily unavailable. Please try again in a moment.";
          } else if (error.message.length < 100 && !error.message.includes("Error:")) {
            // If it's already user-friendly, use it
            errorMsg = error.message;
          }
        }
        result.errors.push(errorMsg);
        reportException(error, {
          context: "Error summarizing thread for contact",
          tags: { component: "summarize-contact-threads", contactId, threadId },
        });
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Summarize contact threads error: ${errorMsg}`);
    reportException(error, {
      context: "Error in summarizeContactThreads",
      tags: { component: "summarize-contact-threads", contactId },
    });
  }

  return result;
}

