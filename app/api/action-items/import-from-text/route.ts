import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { importActionItemsFromText } from "@/lib/action-items";
import { reportException } from "@/lib/error-reporting";

/**
 * POST /api/action-items/import-from-text
 * Import action items from text (splits by newlines)
 */
export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { contactId, actionItemsText } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required" },
        { status: 400 }
      );
    }

    if (!actionItemsText || typeof actionItemsText !== "string") {
      return NextResponse.json(
        { error: "actionItemsText is required and must be a string" },
        { status: 400 }
      );
    }

    const createdIds = await importActionItemsFromText(
      userId,
      contactId,
      actionItemsText
    );

    return NextResponse.json({
      success: true,
      createdCount: createdIds.length,
      actionItemIds: createdIds,
    });
  } catch (error) {
    reportException(error, {
      context: "Importing action items from text",
      tags: { component: "import-action-items-api" },
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

