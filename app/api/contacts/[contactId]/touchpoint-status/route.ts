import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * PATCH /api/contacts/[contactId]/touchpoint-status
 * Update touchpoint status for a contact
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
    const { status, reason } = body;

    // Validate status
    if (status && !["pending", "completed", "cancelled"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'pending', 'completed', or 'cancelled'" },
        { status: 400 }
      );
    }

    // Update contact
    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (status === null) {
      // Clear status (restore to default)
      updates.touchpointStatus = null;
      updates.touchpointStatusUpdatedAt = null;
      updates.touchpointStatusReason = null;
    } else {
      updates.touchpointStatus = status;
      updates.touchpointStatusUpdatedAt = FieldValue.serverTimestamp();
      if (reason !== undefined) {
        updates.touchpointStatusReason = reason || null;
      }
    }

    await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating touchpoint status:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

