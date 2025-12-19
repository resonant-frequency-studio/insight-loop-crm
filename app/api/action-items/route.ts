import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import {
  createActionItem,
  updateActionItem,
  deleteActionItem,
  getActionItemsForContact,
} from "@/lib/action-items";
import { reportException } from "@/lib/error-reporting";
import { revalidateTag } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET /api/action-items?contactId=xxx
 * Get all action items for a contact
 */
export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId parameter is required" },
        { status: 400 }
      );
    }

    const actionItems = await getActionItemsForContact(userId, contactId);
    return NextResponse.json({ actionItems });
  } catch (error) {
    reportException(error, {
      context: "Fetching action items",
      tags: { component: "action-items-api" },
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    
    // Check for quota errors and return appropriate status
    if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("Quota exceeded")) {
      return NextResponse.json(
        { 
          error: "Database quota exceeded. Please wait a few hours or upgrade your plan.",
          quotaExceeded: true 
        },
        { status: 429 } // Too Many Requests
      );
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/action-items
 * Create a new action item
 */
export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { contactId, text, dueDate } = body;

    if (!contactId || !text) {
      return NextResponse.json(
        { error: "contactId and text are required" },
        { status: 400 }
      );
    }

    const actionItemId = await createActionItem(userId, contactId, {
      text,
      dueDate: dueDate || null,
    });

    // Invalidate meeting insights for all calendar events linked to this contact
    try {
      const eventsCollection = adminDb
        .collection("users")
        .doc(userId)
        .collection("calendarEvents");
      
      const linkedEventsSnapshot = await eventsCollection
        .where("matchedContactId", "==", contactId)
        .get();

      if (!linkedEventsSnapshot.empty) {
        const batch = adminDb.batch();
        linkedEventsSnapshot.docs.forEach((doc) => {
          batch.update(doc.ref, {
            meetingInsights: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
      }
    } catch (invalidationError) {
      // Log but don't fail if insight invalidation fails
      reportException(invalidationError, {
        context: "Invalidating meeting insights after action item creation",
        tags: { component: "action-items-api", contactId },
      });
    }

    // Invalidate cache
    revalidateTag("action-items", "max");
    revalidateTag(`action-items-${userId}`, "max");
    revalidateTag(`action-items-${userId}-${contactId}`, "max");

    return NextResponse.json({
      success: true,
      actionItemId,
    });
  } catch (error) {
    reportException(error, {
      context: "Creating action item",
      tags: { component: "action-items-api" },
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/action-items?contactId=xxx&actionItemId=yyy
 * Update an action item
 */
export async function PATCH(req: Request) {
  try {
    const userId = await getUserId();
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contactId");
    const actionItemId = url.searchParams.get("actionItemId");

    if (!contactId || !actionItemId) {
      return NextResponse.json(
        { error: "contactId and actionItemId parameters are required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { text, status, dueDate } = body;

    await updateActionItem(userId, contactId, actionItemId, {
      text,
      status,
      dueDate,
    });

    // Invalidate cache
    revalidateTag("action-items", "max");
    revalidateTag(`action-items-${userId}`, "max");
    revalidateTag(`action-items-${userId}-${contactId}`, "max");

    return NextResponse.json({ success: true });
  } catch (error) {
    reportException(error, {
      context: "Updating action item",
      tags: { component: "action-items-api" },
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/action-items?contactId=xxx&actionItemId=yyy
 * Delete an action item
 */
export async function DELETE(req: Request) {
  try {
    const userId = await getUserId();
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contactId");
    const actionItemId = url.searchParams.get("actionItemId");

    if (!contactId || !actionItemId) {
      return NextResponse.json(
        { error: "contactId and actionItemId parameters are required" },
        { status: 400 }
      );
    }

    await deleteActionItem(userId, contactId, actionItemId);

    // Invalidate cache
    revalidateTag("action-items", "max");
    revalidateTag(`action-items-${userId}`, "max");
    revalidateTag(`action-items-${userId}-${contactId}`, "max");

    return NextResponse.json({ success: true });
  } catch (error) {
    reportException(error, {
      context: "Deleting action item",
      tags: { component: "action-items-api" },
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

