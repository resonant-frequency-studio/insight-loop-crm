import { Firestore } from "firebase-admin/firestore";
import { aggregateContactSummaries } from "./aggregate-contact";
import { reportException } from "@/lib/error-reporting";
import { getUserEmail } from "@/lib/auth-utils";
import { isOwnerContact } from "@/lib/contacts/owner-utils";

/**
 * Summarize pain points from all threads into a single brief string
 * Uses Gemini to create a concise summarization
 */
async function summarizePainPoints(painPoints: string[]): Promise<string | null> {
  if (!painPoints || painPoints.length === 0) {
    return null;
  }

  // If only one pain point, return it directly (no need for summarization)
  if (painPoints.length === 1) {
    return painPoints[0];
  }

  try {
    // Combine all pain points into a list for Gemini to summarize
    const painPointsList = painPoints
      .filter(Boolean)
      .map((p, i) => `${i + 1}. ${p.trim()}`)
      .join("\n");

    const prompt = `You are analyzing pain points gathered from multiple email threads with a client.

Here are the pain points identified across all email threads:

${painPointsList}

Please provide a brief, concise summarization of these pain points as a single sentence or short phrase. Combine related themes and avoid repetition. The output should be a brief summary (not a list), for example: "Issues with time management, improving productivity and efficiency" or "Challenges with team coordination and communication".

Return ONLY the summarized text, no bullet points, no numbering, no separators.`;

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
          context: "Error summarizing pain points",
          tags: { component: "generate-contact-insights" },
        }
      );
      // Fallback: join with commas if Gemini fails
      return painPoints.filter(Boolean).join(", ");
    }

    const geminiData = await geminiResponse.json();
    let text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Strip markdown code blocks if present
    text = text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json|text)?\n?/i, "");
      text = text.replace(/\n?```$/i, "");
      text = text.trim();
    }

    return text || painPoints.filter(Boolean).join(", ");
  } catch (error) {
    reportException(error, {
      context: "Error summarizing pain points with Gemini",
      tags: { component: "generate-contact-insights" },
    });
    // Fallback: join with commas if summarization fails
    return painPoints.filter(Boolean).join(", ");
  }
}

export interface GenerateInsightsResult {
  success: boolean;
  hasInsights: boolean;
  error?: string;
}

/**
 * Generate and update contact insights by aggregating thread summaries
 * Uses existing aggregateContactSummaries function
 * 
 * @param db - Firestore instance
 * @param userId - User ID
 * @param contactId - Contact ID
 * @returns Result indicating success and whether insights were generated
 */
export async function generateContactInsights(
  db: Firestore,
  userId: string,
  contactId: string
): Promise<GenerateInsightsResult> {
  try {
    // Get contact data first to check if it's the owner
    const contactDoc = await db
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .get();

    if (!contactDoc.exists) {
      return {
        success: false,
        hasInsights: false,
        error: "Contact not found",
      };
    }

    const contactData = contactDoc.data();
    
    // Skip insights generation for owner contacts
    const userEmail = await getUserEmail();
    if (contactData?.primaryEmail && isOwnerContact(userEmail, contactData.primaryEmail)) {
      return {
        success: true,
        hasInsights: false,
      };
    }

    // Aggregate summaries from all threads for this contact
    const aggregated = await aggregateContactSummaries(db, userId, contactId);

    const threadCount = contactData?.threadCount || 0;
    const lastEmailDate = contactData?.lastEmailDate;

    // Calculate engagement score based on thread count and recency
    const engagementScore = calculateEngagementScore(threadCount, lastEmailDate);

    if (!aggregated) {
      // No summaries available, but we can still update engagement score
      await db
        .collection("users")
        .doc(userId)
        .collection("contacts")
        .doc(contactId)
        .update({
          engagementScore,
          updatedAt: Date.now(),
        });

      return {
        success: true,
        hasInsights: false,
      };
    }

    // Skip action items and touchpoints - per user request, contact sync should not create these
    // Summarize pain points into a single brief string using Gemini
    const painPointsStr = aggregated.painPoints && aggregated.painPoints.length > 0
      ? await summarizePainPoints(aggregated.painPoints)
      : null;
    // Convert coaching themes array to string (keep as joined for now, can be summarized later if needed)
    const coachingThemesStr = aggregated.coachingThemes && aggregated.coachingThemes.length > 0
      ? aggregated.coachingThemes.join("\n\n---\n\n")
      : null;

    // Update contact with aggregated insights (excluding action items and touchpoints)
    await db
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .update({
        summary: aggregated.summary,
        sentiment: aggregated.sentiment,
        relationshipInsights: aggregated.relationshipInsights,
        painPoints: painPointsStr,
        coachingThemes: coachingThemesStr,
        outreachDraft: aggregated.outreachDraft,
        engagementScore,
        summaryUpdatedAt: aggregated.updatedAt,
        updatedAt: Date.now(),
      });

    return {
      success: true,
      hasInsights: true,
    };
  } catch (error) {
    let errorMsg = "Failed to generate contact insights.";
    if (error instanceof Error) {
      if (error.message.includes("requires an index")) {
        errorMsg = "Database configuration needed. Please contact support.";
      } else if (error.message.length < 100 && !error.message.includes("Error:")) {
        // If it's already user-friendly, use it
        errorMsg = error.message;
      }
    }
    reportException(error, {
      context: "Error generating contact insights",
      tags: { component: "generate-contact-insights", contactId },
    });

    return {
      success: false,
      hasInsights: false,
      error: errorMsg,
    };
  }
}

/**
 * Calculate engagement score (0-100) based on thread count and last email recency
 * 
 * @param threadCount - Number of email threads with this contact
 * @param lastEmailDate - ISO string or Firestore timestamp of last email date
 * @returns Engagement score from 0-100
 */
function calculateEngagementScore(
  threadCount: number,
  lastEmailDate: unknown
): number {
  // Base score from thread count (0-60 points)
  // 0 threads = 0, 1-2 threads = 20, 3-5 threads = 40, 6+ threads = 60
  let threadScore = 0;
  if (threadCount === 0) {
    threadScore = 0;
  } else if (threadCount <= 2) {
    threadScore = 20;
  } else if (threadCount <= 5) {
    threadScore = 40;
  } else {
    threadScore = 60;
  }

  // Recency score (0-40 points)
  // More recent emails = higher score
  let recencyScore = 0;
  if (lastEmailDate) {
    let lastEmail: Date;
    
    // Handle Firestore timestamp or ISO string
    if (typeof lastEmailDate === "string") {
      lastEmail = new Date(lastEmailDate);
    } else if (lastEmailDate && typeof lastEmailDate === "object" && "toDate" in lastEmailDate) {
      // Firestore Timestamp
      lastEmail = (lastEmailDate as { toDate: () => Date }).toDate();
    } else if (lastEmailDate && typeof lastEmailDate === "object" && "seconds" in lastEmailDate) {
      // Firestore Timestamp with seconds property
      lastEmail = new Date((lastEmailDate as { seconds: number }).seconds * 1000);
    } else {
      lastEmail = new Date(String(lastEmailDate));
    }

    if (!isNaN(lastEmail.getTime())) {
      const daysSinceLastEmail = Math.floor(
        (Date.now() - lastEmail.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Scoring based on days since last email:
      // 0-7 days = 40 points (very recent)
      // 8-30 days = 30 points (recent)
      // 31-90 days = 20 points (somewhat recent)
      // 91-180 days = 10 points (not recent)
      // 181+ days = 0 points (old)
      if (daysSinceLastEmail <= 7) {
        recencyScore = 40;
      } else if (daysSinceLastEmail <= 30) {
        recencyScore = 30;
      } else if (daysSinceLastEmail <= 90) {
        recencyScore = 20;
      } else if (daysSinceLastEmail <= 180) {
        recencyScore = 10;
      } else {
        recencyScore = 0;
      }
    }
  }

  return Math.min(100, threadScore + recencyScore);
}

