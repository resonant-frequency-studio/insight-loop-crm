import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { aggregateContactSummaries } from "@/lib/gmail/aggregate-contact";
import { getUserId } from "@/lib/auth-utils";

export async function GET() {
  const userId = await getUserId();
  const contactsCol = adminDb
    .collection("users")
    .doc(userId)
    .collection("contacts");

  const contactsSnap = await contactsCol.get();

  for (const doc of contactsSnap.docs) {
    const contactId = doc.id;
    const aggregated = await aggregateContactSummaries(
      adminDb,
      userId,
      contactId
    );

    if (!aggregated) continue;

    await contactsCol.doc(contactId).update({
      summary: aggregated.summary,
      actionItems: aggregated.actionItems,
      sentiment: aggregated.sentiment,
      relationshipInsights: aggregated.relationshipInsights,
      painPoints: aggregated.painPoints,
      coachingThemes: aggregated.coachingThemes,
      outreachDraft: aggregated.outreachDraft,
      nextTouchpointMessage: aggregated.nextTouchpointMessage,
      nextTouchpointDate: aggregated.nextTouchpointDate,
      updatedAt: aggregated.updatedAt,
    });
  }

  return NextResponse.json({ ok: true });
}
