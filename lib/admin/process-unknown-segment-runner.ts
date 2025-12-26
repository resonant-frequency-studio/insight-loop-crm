import { adminDb } from "@/lib/firebase-admin";
import { getAccessToken } from "@/lib/gmail/get-access-token";
import { syncContactThreads } from "@/lib/gmail/sync-contact-threads";
import { summarizeContactThreads } from "@/lib/gmail/summarize-contact-threads";
import { generateContactInsights } from "@/lib/gmail/generate-contact-insights";
import { contactsPath } from "@/lib/firestore-paths";
import { Contact, AdminJob } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";
import { FieldValue } from "firebase-admin/firestore";
import type { QueryDocumentSnapshot, Query } from "firebase-admin/firestore";

interface ProcessResult {
  contactId: string;
  contactEmail: string;
  contactName: string;
  action: "processed" | "skipped" | "error";
  threadsSynced?: number;
  threadsSummarized?: number;
  insightsGenerated?: boolean;
  tagsGenerated?: string[];
  error?: string;
}

/**
 * Generate tags for a contact based on their email threads using Gemini
 */
async function generateTagsFromThreads(
  userId: string,
  contactId: string
): Promise<string[] | null> {
  try {
    // Get all threads for this contact that have summaries
    const threadsSnap = await adminDb
      .collection("users")
      .doc(userId)
      .collection("threads")
      .where("contactId", "==", contactId)
      .where("summary", "!=", null)
      .limit(20) // Limit to avoid token limits
      .get();

    if (threadsSnap.empty) {
      return null; // No threads with summaries
    }

    // Collect summaries from threads
    const summaries: Array<{
      summary: string;
      sentiment?: string;
      painPoints?: string[];
      coachingThemes?: string[];
    }> = [];

    threadsSnap.forEach((doc) => {
      const data = doc.data();
      const summary = data.summary;
      if (summary) {
        summaries.push({
          summary: summary.summary || "",
          sentiment: summary.sentiment,
          painPoints: summary.painPoints || [],
          coachingThemes: summary.coachingThemes || [],
        });
      }
    });

    if (summaries.length === 0) {
      return null;
    }

    // Build prompt for Gemini to generate tags
    const summariesText = summaries
      .map((s, i) => {
        const parts: string[] = [];
        parts.push(`Thread ${i + 1}:`);
        if (s.summary) parts.push(`Summary: ${s.summary}`);
        if (s.sentiment) parts.push(`Sentiment: ${s.sentiment}`);
        if (s.painPoints && s.painPoints.length > 0) {
          parts.push(`Pain Points: ${s.painPoints.join(", ")}`);
        }
        if (s.coachingThemes && s.coachingThemes.length > 0) {
          parts.push(`Coaching Themes: ${s.coachingThemes.join(", ")}`);
        }
        return parts.join("\n");
      })
      .join("\n\n---\n\n");

    const prompt = `You are analyzing email threads between a leadership coach and a client to generate relevant tags for contact management.

Based on the following email thread summaries, generate 3-4 concise tags that best describe this contact. Tags should be:
- Short (1-3 words each)
- Relevant to the relationship and communication patterns
- Useful for contact segmentation and organization
- Professional and appropriate

Examples of good tags: "Executive", "High Priority", "Coaching Client", "Tech Industry", "Quarterly Check-in", "Time Management Focus", "Growth Mindset"

Email Thread Summaries:
${summariesText}

Return ONLY a JSON array of 3-4 tag strings, for example: ["Executive", "High Priority", "Coaching Client", "Tech Industry"]
Do not include any other text, explanations, or markdown formatting.`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      reportException(
        new Error(`Gemini API error: ${geminiResponse.status} ${errorText}`),
        {
          context: "Error generating tags from threads",
          tags: { component: "generate-tags", contactId },
        }
      );
      return null;
    }

    const geminiData = await geminiResponse.json();
    let text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Strip markdown code blocks if present
    text = text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/i, "");
      text = text.replace(/\n?```$/i, "");
      text = text.trim();
    }

    // Parse JSON array
    let tags: string[];
    try {
      tags = JSON.parse(text);
      if (!Array.isArray(tags)) {
        throw new Error("Response is not an array");
      }
      // Validate and clean tags
      tags = tags
        .filter((tag) => typeof tag === "string" && tag.trim().length > 0)
        .map((tag) => tag.trim())
        .slice(0, 4); // Limit to 4 tags max
    } catch (parseError) {
      reportException(parseError as Error, {
        context: "Failed to parse tags JSON response",
        tags: { component: "generate-tags", contactId },
        extra: { rawText: text.substring(0, 500) },
      });
      return null;
    }

    return tags.length > 0 ? tags : null;
  } catch (error) {
    reportException(error as Error, {
      context: "Error generating tags from threads",
      tags: { component: "generate-tags", contactId },
    });
    return null;
  }
}

/**
 * Process a single contact: sync threads, generate insights, and create tags
 */
async function processContact(
  userId: string,
  contact: QueryDocumentSnapshot,
  dryRun: boolean
): Promise<ProcessResult> {
  const contactData = contact.data() as Contact;
  const contactId = contact.id;
  const contactEmail = contactData.primaryEmail || "unknown";
  const contactName = `${contactData.firstName || ""} ${contactData.lastName || ""}`.trim() || contactEmail;

  const result: ProcessResult = {
    contactId,
    contactEmail,
    contactName,
    action: "processed",
  };

  try {
    // Check if contact has email
    if (!contactData.primaryEmail) {
      result.action = "skipped";
      return result;
    }

    // Skip if contact already has Gmail threads synced or insights generated
    const hasThreads = (contactData.threadCount || 0) > 0;
    const hasInsights = !!contactData.summary;
    
    if (hasThreads || hasInsights) {
      result.action = "skipped";
      result.error = hasThreads && hasInsights 
        ? "Already has Gmail threads and insights"
        : hasThreads 
        ? "Already has Gmail threads synced"
        : "Already has contact insights";
      return result;
    }

    // Get Gmail access token
    let accessToken: string;
    try {
      accessToken = await getAccessToken(userId);
    } catch (error) {
      result.action = "error";
      result.error = error instanceof Error ? error.message : "Failed to get Gmail access token";
      return result;
    }

    if (dryRun) {
      return result;
    }

    // Step 1: Sync Gmail threads
    try {
      const syncResult = await syncContactThreads(
        adminDb,
        userId,
        contactEmail,
        contactId,
        accessToken,
        500 // maxResults
      );
      result.threadsSynced = syncResult.processedThreads;
    } catch (error) {
      result.action = "error";
      result.error = `Gmail sync failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      return result;
    }

    // Step 2: Summarize threads (only if we synced threads)
    if (result.threadsSynced && result.threadsSynced > 0) {
      try {
        const summarizeResult = await summarizeContactThreads(adminDb, userId, contactId, 10);
        result.threadsSummarized = summarizeResult.summarized;
      } catch {
        // Continue even if summarization fails
      }
    }

    // Step 3: Generate contact insights
    try {
      const insightsResult = await generateContactInsights(adminDb, userId, contactId);
      result.insightsGenerated = insightsResult.hasInsights;
    } catch {
      // Continue even if insights generation fails
    }

    // Step 4: Generate tags (only if we have threads with summaries)
    if (result.threadsSummarized && result.threadsSummarized > 0) {
      try {
        const tags = await generateTagsFromThreads(userId, contactId);

        if (tags && tags.length > 0) {
          // Merge tags with existing tags (avoid duplicates)
          const existingTags = contactData.tags || [];
          const newTags = tags.filter((tag) => !existingTags.includes(tag));
          const allTags = [...existingTags, ...newTags];

          // Update contact with new tags
          await adminDb
            .collection("users")
            .doc(userId)
            .collection("contacts")
            .doc(contactId)
            .update({
              tags: allTags,
              updatedAt: Date.now(),
            });

          result.tagsGenerated = newTags;
        }
      } catch {
        // Continue even if tag generation fails
      }
    }
  } catch (error) {
    result.action = "error";
    result.error = error instanceof Error ? error.message : "Unknown error";
    reportException(error as Error, {
      context: "Error processing contact in unknown segment script",
      tags: { component: "process-unknown-segment", contactId, userId },
    });
  }

  return result;
}

/**
 * Update admin job progress
 */
async function updateAdminJob(
  userId: string,
  jobId: string,
  updates: Partial<AdminJob> & Record<string, unknown>
): Promise<void> {
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined)
  );

  const docRef = adminDb
    .collection("users")
    .doc(userId)
    .collection("adminJobs")
    .doc(jobId);

  await docRef.set(
    {
      jobId,
      userId,
      ...cleanUpdates,
      updatedAt: FieldValue.serverTimestamp(),
    } as Record<string, unknown>,
    { merge: true }
  );
}

/**
 * Background job runner for processing unknown segment contacts
 */
export async function runProcessUnknownSegmentJob({
  userId,
  jobId,
  dryRun,
  segment,
  limit,
  batchSize = 5,
}: {
  userId: string;
  jobId: string;
  dryRun: boolean;
  segment: string;
  limit: number;
  batchSize?: number;
}): Promise<void> {
  try {
    // Initialize job
    await updateAdminJob(userId, jobId, {
      jobType: "process-segment",
      status: "running",
      startedAt: FieldValue.serverTimestamp(),
      processed: 0,
      skipped: 0,
      errors: 0,
      total: 0,
      currentStep: "finding_contacts",
      dryRun,
      limit,
      segment,
      details: [],
    });

    // Count total contacts first
    let totalCount = 0;
    let lastDoc: QueryDocumentSnapshot | null = null;
    let hasMore = true;

    while (hasMore) {
      let query: Query = adminDb
        .collection(contactsPath(userId))
        .where("segment", "==", segment);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      query = query.limit(1000); // Count in batches

      const snapshot = await query.get();
      totalCount += snapshot.size;
      hasMore = snapshot.size === 1000;

      if (!snapshot.empty) {
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
      } else {
        hasMore = false;
      }
    }

    // Update with total count
    await updateAdminJob(userId, jobId, {
      total: totalCount,
      currentStep: "processing_contacts",
    });

    // Process contacts
    let contactsProcessed = 0;
    lastDoc = null;
    hasMore = true;
    const details: ProcessResult[] = [];

    while (hasMore && (limit === 10000 || contactsProcessed < limit)) {
      let query: Query = adminDb
        .collection(contactsPath(userId))
        .where("segment", "==", segment);

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

      // Process contacts sequentially to avoid rate limits
      for (const contact of contacts) {
        const result = await processContact(userId, contact, dryRun);

        details.push(result);

        let processed = 0;
        let skipped = 0;
        let errors = 0;

        if (result.action === "processed") {
          processed = 1;
        } else if (result.action === "skipped") {
          skipped = 1;
        } else {
          errors = 1;
        }

        // Update progress
        await updateAdminJob(userId, jobId, {
          processed: FieldValue.increment(processed) as unknown as number,
          skipped: FieldValue.increment(skipped) as unknown as number,
          errors: FieldValue.increment(errors) as unknown as number,
          details: details.slice(-100), // Keep last 100 details to avoid document size limits
        });

        // Add delay between contacts to avoid rate limits
        if (!dryRun && contacts.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
        }
      }

      contactsProcessed += contacts.length;
      lastDoc = contacts[contacts.length - 1];
      hasMore = contacts.length === batchSize;
    }

    // Mark as complete
    await updateAdminJob(userId, jobId, {
      status: "complete",
      finishedAt: FieldValue.serverTimestamp(),
      currentStep: "complete",
      details: details.slice(-100), // Final update with last 100 details
    });
  } catch (error) {
    reportException(error as Error, {
      context: "Error in process unknown segment job runner",
      tags: { component: "process-unknown-segment-runner", userId, jobId },
    });

    // Mark as error
    await updateAdminJob(userId, jobId, {
      status: "error",
      finishedAt: FieldValue.serverTimestamp(),
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

