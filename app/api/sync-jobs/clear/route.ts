import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { syncJobsPath } from "@/lib/firestore-paths";
import { reportException } from "@/lib/error-reporting";
import { revalidateTag } from "next/cache";

/**
 * DELETE /api/sync-jobs/clear
 * Clear sync history, keeping only the most recent sync job
 */
export async function DELETE() {
  try {
    const userId = await getUserId();
    
    // Get all sync jobs ordered by startedAt descending
    const snapshot = await adminDb
      .collection(syncJobsPath(userId))
      .orderBy("startedAt", "desc")
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ 
        success: true, 
        deleted: 0,
        message: "No sync history to clear" 
      });
    }

    // Keep the most recent one, delete the rest
    const jobsToDelete = snapshot.docs.slice(1); // Skip the first (most recent)
    
    if (jobsToDelete.length === 0) {
      // Invalidate cache even when nothing to delete
      revalidateTag("sync-jobs", "max");
      revalidateTag(`sync-jobs-${userId}`, "max");
      
      return NextResponse.json({ 
        success: true, 
        deleted: 0,
        message: "Only one sync job exists, nothing to clear" 
      });
    }

    // Delete in batches (Firestore batch limit is 500)
    const batchSize = 500;
    let deleted = 0;
    let errors = 0;

    for (let i = 0; i < jobsToDelete.length; i += batchSize) {
      const batch = adminDb.batch();
      const batchDocs = jobsToDelete.slice(i, i + batchSize);
      
      batchDocs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      try {
        await batch.commit();
        deleted += batchDocs.length;
      } catch (error) {
        reportException(error, {
          context: "Deleting sync jobs batch",
          tags: { component: "clear-sync-jobs", userId },
        });
        errors += batchDocs.length;
      }
    }

    // Invalidate cache
    revalidateTag("sync-jobs", "max");
    revalidateTag(`sync-jobs-${userId}`, "max");

    return NextResponse.json({
      success: errors === 0,
      deleted,
      errors,
      message: errors === 0 
        ? `Cleared ${deleted} sync job${deleted !== 1 ? 's' : ''} from history`
        : `Cleared ${deleted} sync jobs, ${errors} failed to delete`,
    });
  } catch (error) {
    reportException(error, {
      context: "Clear sync history error",
      tags: { component: "clear-sync-jobs-api" },
    });
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear sync history" 
      },
      { status: 500 }
    );
  }
}

