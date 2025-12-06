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

  // Combine fields
  return {
    summary: summaries.map((s) => s.summary || "").join("\n\n"),
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