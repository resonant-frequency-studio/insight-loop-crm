import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { THREAD_SUMMARY_PROMPT } from "@/lib/gemini/prompts";
import { getUserId } from "@/lib/auth-utils";

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

interface SummaryResult {
  threadId: string;
  parsed: ThreadSummary;
}

export async function GET() {
  try {
    const userId = await getUserId();
    const threadCol = adminDb
      .collection("users")
      .doc(userId)
      .collection("threads");

    // 1. Fetch threads needing summaries
    const snap = await threadCol
      .where("needsSummary", "==", true)
      .limit(5) // batch size to avoid token limits
      .get();

    if (snap.empty) {
      return NextResponse.json({
        ok: true,
        message: "No threads need summarization.",
      });
    }

    const summaries: SummaryResult[] = [];

    for (const doc of snap.docs) {
      const threadId = doc.id;

      // 2. Load thread messages
      const msgsSnap = await threadCol
        .doc(threadId)
        .collection("messages")
        .orderBy("internalDate", "asc")
        .get();

      const transcript = msgsSnap.docs
        .map((m) => {
          const data = m.data();
          return `From: ${data.from}\nTo: ${data.to}\nDate: ${data.date}\nSubject: ${data.subject}\n\n${data.body}`;
        })
        .join("\n\n---\n\n");

      // 3. Call Gemini
      const result = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro:generateContent?key=" +
          process.env.GOOGLE_API_KEY,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: THREAD_SUMMARY_PROMPT(transcript) }] }],
          }),
        }
      );

      const json = await result.json();
      const text =
        json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed: ThreadSummary = JSON.parse(text);

      summaries.push({ threadId, parsed });

      // 4. Store summary in Firestore
      await threadCol.doc(threadId).update({
        summary: parsed,
        needsSummary: false,
        summarizedAt: Date.now(),
      });
    }

    return NextResponse.json({
      ok: true,
      summarized: summaries.length,
      summaries,
    });
  } catch (err) {
    console.error("SUMMARY ERROR:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}
