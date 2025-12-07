import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { getAllActionItemsForUser } from "@/lib/action-items";
import { reportException } from "@/lib/error-reporting";
import { ActionItem } from "@/types/firestore";

/**
 * GET /api/action-items/all
 * Get all action items for the authenticated user (across all contacts)
 */
export async function GET() {
  try {
    const userId = await getUserId();
    const actionItems = await getAllActionItemsForUser(userId);
    
    // Include debug info in development
    const response: { actionItems: Array<ActionItem & { contactId: string }>; debug?: { count: number; userId: string } } = { 
      actionItems 
    };
    
    if (process.env.NODE_ENV === "development") {
      response.debug = {
        count: actionItems.length,
        userId,
      };
    }
    
    return NextResponse.json(response);
  } catch (error) {
    reportException(error, {
      context: "Fetching all action items",
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

