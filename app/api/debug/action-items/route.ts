import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";

/**
 * GET /api/debug/action-items
 * Debug endpoint to check action items data and permissions
 */
export async function GET() {
  try {
    const userId = await getUserId();
    
    // Try to fetch action items using collection group query (same as the hook)
    const collectionGroupResults: Array<{
      path: string;
      id: string;
      userId?: string;
      contactId?: string;
      hasUserId: boolean;
    }> = [];
    
    let indexError: string | null = null;
    try {
      // Try query with orderBy to match the index structure (required for the index)
      const snapshot = await adminDb
        .collectionGroup("actionItems")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const pathParts = doc.ref.path.split("/");
        const contactId = pathParts[3];
        
        collectionGroupResults.push({
          path: doc.ref.path,
          id: doc.id,
          userId: data.userId as string | undefined,
          contactId,
          hasUserId: !!data.userId,
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      indexError = errorMessage;
      
      // Try without orderBy as fallback (won't use index but might work)
      try {
        const snapshotWithoutOrderBy = await adminDb
          .collectionGroup("actionItems")
          .where("userId", "==", userId)
          .limit(5)
          .get();
        
        snapshotWithoutOrderBy.docs.forEach((doc) => {
          const data = doc.data();
          const pathParts = doc.ref.path.split("/");
          const contactId = pathParts[3];
          
          collectionGroupResults.push({
            path: doc.ref.path,
            id: doc.id,
            userId: data.userId as string | undefined,
            contactId,
            hasUserId: !!data.userId,
          });
        });
      } catch (fallbackError) {
        return NextResponse.json({
          authenticatedUserId: userId,
          collectionGroupError: errorMessage,
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          suggestion: "Collection group query failed. The index might be missing or not fully built. Check Firebase Console → Firestore → Indexes.",
          indexRequired: "Collection Group: actionItems, Fields: userId (Ascending), createdAt (Descending)",
        });
      }
    }
    
    // Also try a direct subcollection query for comparison
    const subcollectionResults: Array<{
      path: string;
      id: string;
      userId?: string;
      hasUserId: boolean;
    }> = [];
    
    try {
      // Get first contact to test subcollection query
      const contactsSnapshot = await adminDb
        .collection(`users/${userId}/contacts`)
        .limit(1)
        .get();
      
      if (!contactsSnapshot.empty) {
        const contactId = contactsSnapshot.docs[0].id;
        const actionItemsSnapshot = await adminDb
          .collection(`users/${userId}/contacts/${contactId}/actionItems`)
          .limit(5)
          .get();
        
        actionItemsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          subcollectionResults.push({
            path: doc.ref.path,
            id: doc.id,
            userId: data.userId as string | undefined,
            hasUserId: !!data.userId,
          });
        });
      }
    } catch {
      // Non-critical, just log
    }
    
    // Check total count
    let totalCount = 0;
    try {
      const allSnapshot = await adminDb
        .collectionGroup("actionItems")
        .where("userId", "==", userId)
        .get();
      totalCount = allSnapshot.size;
    } catch {
      // Ignore errors for count
    }
    
    return NextResponse.json({
      authenticatedUserId: userId,
      collectionGroupQuery: {
        success: collectionGroupResults.length > 0,
        sampleDocuments: collectionGroupResults,
        totalCount,
        indexError: indexError || null,
      },
      subcollectionQuery: {
        sampleDocuments: subcollectionResults,
      },
      analysis: {
        allHaveUserId: collectionGroupResults.length > 0 && collectionGroupResults.every((doc) => doc.hasUserId),
        userIdsMatch: collectionGroupResults.length > 0 && collectionGroupResults.every((doc) => doc.userId === userId),
        sampleUserIds: collectionGroupResults.map((doc) => doc.userId),
      },
    });
  } catch (error) {
    reportException(error, {
      context: "Debugging action items",
      tags: { component: "debug-action-items" },
    });
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { 
        error: errorMessage,
        authenticatedUserId: null,
      },
      { status: 500 }
    );
  }
}

