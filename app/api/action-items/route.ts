import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import {
  createActionItem,
  updateActionItem,
  deleteActionItem,
  getActionItemsForContact,
} from "@/lib/action-items";

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
    console.error("Error fetching action items:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
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

    return NextResponse.json({
      success: true,
      actionItemId,
    });
  } catch (error) {
    console.error("Error creating action item:", error);
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating action item:", error);
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting action item:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

