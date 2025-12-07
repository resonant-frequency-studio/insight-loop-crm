import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { ErrorLevel, reportException, reportMessage } from "@/lib/error-reporting";

/**
 * POST /api/admin/cleanup-old-touchpoints
 * ONE-TIME SCRIPT: Skip all touchpoints overdue by more than 120 days
 * 
 * ⚠️ This is a cleanup script - run once and then delete this file
 */
export async function POST() {
  try {
    const userId = await getUserId();
    
    // Optional: Add a confirmation token to prevent accidental runs
    // const body = await req.json().catch(() => ({}));
    // const confirmToken = body.confirmToken;
    
    // Uncomment this if you want extra safety (set an env var)
    // if (confirmToken !== process.env.CLEANUP_CONFIRM_TOKEN) {
    //   return NextResponse.json(
    //     { error: "Confirmation token required" },
    //     { status: 403 }
    //   );
    // }

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000); // 120 days ago
    const cutoffTimestamp = cutoffDate.getTime();

    reportMessage(`Cleaning up touchpoints overdue by more than 120 days (older than ${cutoffDate.toISOString()})`, ErrorLevel.INFO);
    // Get all contacts with touchpoints
    const contactsSnapshot = await adminDb
      .collection(`users/${userId}/contacts`)
      .where("nextTouchpointDate", "!=", null)
      .get();

    const contactsToUpdate: Array<{ id: string; date: Date }> = [];

    // Filter contacts with touchpoints older than 5000 days
    for (const doc of contactsSnapshot.docs) {
      const contact = doc.data();
      const touchpointDate = contact.nextTouchpointDate;

      if (!touchpointDate) continue;

      // Parse the date
      let dateObj: Date | null = null;
      if (touchpointDate instanceof Date) {
        dateObj = touchpointDate;
      } else if (typeof touchpointDate === "string") {
        dateObj = new Date(touchpointDate);
      } else if (typeof touchpointDate === "object" && touchpointDate !== null) {
        // Firestore Timestamp
        if ("toDate" in touchpointDate) {
          dateObj = (touchpointDate as { toDate: () => Date }).toDate();
        } else if ("_seconds" in touchpointDate) {
          // Firestore Timestamp format
          const seconds = (touchpointDate as { _seconds: number })._seconds;
          dateObj = new Date(seconds * 1000);
        }
      }

      if (!dateObj || isNaN(dateObj.getTime())) continue;

      // Check if overdue by more than 120 days
      if (dateObj.getTime() < cutoffTimestamp) {
        // Also only update if status is pending or null (not already completed/cancelled)
        const status = contact.touchpointStatus;
        if (!status || status === "pending") {
          contactsToUpdate.push({ id: doc.id, date: dateObj });
        }
      }
    }

    reportMessage(`Found ${contactsToUpdate.length} contacts to update`, ErrorLevel.INFO);
    
    // Update all matching contacts
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const contact of contactsToUpdate) {
      try {
        await adminDb
          .collection("users")
          .doc(userId)
          .collection("contacts")
          .doc(contact.id)
          .update({
            touchpointStatus: "cancelled",
            touchpointStatusUpdatedAt: FieldValue.serverTimestamp(),
            touchpointStatusReason: "Auto-skipped: Overdue by more than 120 days (cleanup script)",
            updatedAt: FieldValue.serverTimestamp(),
          });
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Contact ${contact.id}: ${errorMsg}`);
        reportException(error, {
          context: "Updating contact during cleanup",
          tags: { component: "cleanup-old-touchpoints", contactId: contact.id },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup complete: ${successCount} touchpoints skipped, ${errorCount} errors`,
      stats: {
        totalChecked: contactsSnapshot.size,
        foundOldTouchpoints: contactsToUpdate.length,
        successfullyUpdated: successCount,
        errors: errorCount,
        errorsDetails: errors.slice(0, 10), // First 10 errors
      },
    });
  } catch (error) {
    reportException(error, {
      context: "Cleanup script error",
      tags: { component: "cleanup-old-touchpoints" },
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

