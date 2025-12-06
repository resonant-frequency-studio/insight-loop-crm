import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { getAllActionItemsForUser } from "@/lib/action-items";

/**
 * GET /api/action-items/all
 * Get all action items for the authenticated user (across all contacts)
 */
export async function GET() {
  try {
    const userId = await getUserId();
    const actionItems = await getAllActionItemsForUser(userId);
    return NextResponse.json({ actionItems });
  } catch (error) {
    console.error("Error fetching all action items:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

