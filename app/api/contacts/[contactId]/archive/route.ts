import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { reportException } from "@/lib/error-reporting";

/**
 * PATCH /api/contacts/[contactId]/archive
 * Archive or unarchive a single contact
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const userId = await getUserId();
    const { contactId: contactIdParam } = await params;
    const contactId = decodeURIComponent(contactIdParam);
    const body = await req.json();
    const { archived } = body;

    if (typeof archived !== "boolean") {
      return NextResponse.json(
        { error: "archived must be a boolean" },
        { status: 400 }
      );
    }

    await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .update({
        archived: archived,
        updatedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    reportException(error, {
      context: "Archiving contact",
      tags: { component: "archive-contact-api", contactId: contactIdParam },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive contact" },
      { status: 500 }
    );
  }
}

