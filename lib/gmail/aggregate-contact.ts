import type { Firestore } from "firebase-admin/firestore";

interface ThreadSummary {
  summary?: string;
  actionItems?: string[];
  sentiment?: string;
  relationshipInsights?: string;
  painPoints?: string[];
  coachingThemes?: string[];
  outreachDraft?: string;
  nextTouchpointMessage?: string;
  nextTouchpointDate?: string;
}

interface AggregatedContactData {
  summary: string;
  actionItems: string[];
  sentiment: string;
  relationshipInsights: string;
  painPoints: string[];
  coachingThemes: string[];
  outreachDraft: string;
  nextTouchpointMessage: string;
  nextTouchpointDate: string;
  updatedAt: number;
}

export async function aggregateContactSummaries(
  db: Firestore,
  userId: string,
  contactId: string
): Promise<AggregatedContactData | null> {
  const threadsSnap = await db
    .collection("users")
    .doc(userId)
    .collection("threads")
    .where("contactId", "==", contactId)
    .get();

  const summaries: ThreadSummary[] = [];
  threadsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.summary) {
      summaries.push(data.summary as ThreadSummary);
    }
  });

  if (summaries.length === 0) return null;

  // Combine summaries from all threads
  // Since each thread summary is already limited to 1-2 paragraphs by the prompt,
  // we combine them but cap the total length to ~400 characters (1-2 paragraphs)
  const combinedSummary = summaries
    .map((s) => s.summary || "")
    .filter(Boolean)
    .join("\n\n");
  
  // Limit combined summary to approximately 400 characters (1-2 paragraphs)
  // Cut at word boundary if truncating to avoid cutting words in half
  const limitedSummary = combinedSummary.length > 400
    ? combinedSummary.substring(0, 400).replace(/\s+\S*$/, '') + '...'
    : combinedSummary;

  // Combine fields
  return {
    summary: limitedSummary,
    actionItems: summaries.flatMap((s) => s.actionItems || []),
    sentiment: "mixed", // optional to compute later
    relationshipInsights: summaries
      .map((s) => s.relationshipInsights || "")
      .join("\n\n"),
    painPoints: summaries.flatMap((s) => s.painPoints || []),
    coachingThemes: summaries.flatMap((s) => s.coachingThemes || []),
    outreachDraft: summaries.at(-1)?.outreachDraft || "",
    nextTouchpointMessage: summaries.at(-1)?.nextTouchpointMessage || "",
    nextTouchpointDate: summaries.at(-1)?.nextTouchpointDate || "",
    updatedAt: Date.now(),
  };
}