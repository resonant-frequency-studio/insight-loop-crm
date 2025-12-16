import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { reportException } from "@/lib/error-reporting";
import { revalidateTag } from "next/cache";
import { Contact } from "@/types/firestore";
import { convertTimestamp } from "@/util/timestamp-utils-server";
import { syncTouchpointStatusToCalendar } from "@/lib/calendar/sync-touchpoints";

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

    // Fetch the updated contact to return in response
    const updatedDoc = await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .get();

    if (!updatedDoc.exists) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    const contactData = updatedDoc.data() as Contact;
    const updatedContact: Contact = {
      ...contactData,
      contactId: updatedDoc.id,
      createdAt: convertTimestamp(contactData.createdAt),
      updatedAt: convertTimestamp(contactData.updatedAt),
      lastEmailDate: contactData.lastEmailDate ? convertTimestamp(contactData.lastEmailDate) : null,
      nextTouchpointDate: contactData.nextTouchpointDate ? convertTimestamp(contactData.nextTouchpointDate) : null,
      touchpointStatusUpdatedAt: contactData.touchpointStatusUpdatedAt ? convertTimestamp(contactData.touchpointStatusUpdatedAt) : null,
      summaryUpdatedAt: contactData.summaryUpdatedAt ? convertTimestamp(contactData.summaryUpdatedAt) : null,
    };

    // Sync touchpoint status to calendar
    try {
      await syncTouchpointStatusToCalendar(adminDb, userId, contactId, status);
      // Invalidate calendar events cache
      revalidateTag(`calendar-events-${userId}`, "max");
    } catch (error) {
      // Log error but don't fail the status update
      reportException(error, {
        context: "Syncing touchpoint status to calendar",
        tags: { component: "touchpoint-status-api", userId, contactId },
      });
    }

    // Invalidate cache
    revalidateTag("contacts", "max");
    revalidateTag(`contacts-${userId}`, "max");
    revalidateTag(`contact-${userId}-${contactId}`, "max");
    revalidateTag(`dashboard-stats-${userId}`, "max");

    // Return the updated contact data so client can update cache directly
    // This prevents the optimistic update from being overwritten by stale cache
    return NextResponse.json({ 
      success: true,
      contact: updatedContact,
    });
  } catch (error) {
    reportException(error, {
      context: "Updating touchpoint status",
      tags: { component: "touchpoint-status-api" },
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

