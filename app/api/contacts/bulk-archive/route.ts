import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/contacts/bulk-archive
 * Bulk archive or unarchive contacts
 */
export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { contactIds, archived } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "contactIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (typeof archived !== "boolean") {
      return NextResponse.json(
        { error: "archived must be a boolean" },
        { status: 400 }
      );
    }

    let success = 0;
    let errors = 0;
    const errorDetails: string[] = [];
    const batchSize = 10;

    // Process in batches
    for (let i = 0; i < contactIds.length; i += batchSize) {
      const batch = contactIds.slice(i, i + batchSize);
      
      const promises = batch.map(async (contactId: string) => {
        try {
          await adminDb
            .collection("users")
            .doc(userId)
            .collection("contacts")
            .doc(contactId)
            .update({
              archived: archived,
              updatedAt: FieldValue.serverTimestamp(),
            });
          return { success: true, contactId };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          return { success: false, contactId, error: errorMsg };
        }
      });

      const results = await Promise.all(promises);
      
      results.forEach((result) => {
        if (result.success) {
          success++;
        } else {
          errors++;
          errorDetails.push(`${result.contactId}: ${result.error}`);
        }
      });
    }

    return NextResponse.json({
      success,
      errors,
      errorDetails,
    });
  } catch (error) {
    console.error("Error bulk archiving contacts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive contacts" },
      { status: 500 }
    );
  }
}

