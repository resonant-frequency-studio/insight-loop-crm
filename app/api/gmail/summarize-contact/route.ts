import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { aggregateContactSummaries } from "@/lib/gmail/aggregate-contact";
import { getUserId } from "@/lib/auth-utils";
import { importActionItemsFromArray } from "@/lib/action-items";
import { reportException } from "@/lib/error-reporting";

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

    // Convert action items to subcollection format (for backward compatibility with old summaries)
    if (aggregated.actionItems && aggregated.actionItems.length > 0) {
      try {
        await importActionItemsFromArray(
          userId,
          contactId,
          aggregated.actionItems
        );
      } catch (error) {
        reportException(error, {
          context: "Importing action items for contact during summarization",
          tags: { component: "summarize-contact", contactId },
        });
        // Don't fail the aggregation if action item import fails
      }
    }

    // Update contact with aggregated data (excluding actionItems since they're now in subcollection)
    await contactsCol.doc(contactId).update({
      summary: aggregated.summary,
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
