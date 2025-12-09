import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { isTestMode } from "@/util/test-utils";

/**
 * GET /api/test/debug-contact
 * Test-only endpoint to check contact directly from Firestore (bypassing cache)
 * This is only available in E2E_TEST_MODE
 */
export async function GET(req: Request) {
  // Only allow in test mode
  if (!isTestMode()) {
    return NextResponse.json({ 
      error: "Not available in production",
      debug: {
        E2E_TEST_MODE: process.env.E2E_TEST_MODE,
        NODE_ENV: process.env.NODE_ENV,
      }
    }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const contactId = url.searchParams.get("contactId");

    if (!userId || !contactId) {
      return NextResponse.json(
        { error: "userId and contactId query parameters are required" },
        { status: 400 }
      );
    }

    // Direct Firestore query bypassing cache
    // Also check if the collection exists and list all contact IDs for debugging
    const contactsSnapshot = await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .get();
    
    const allContactIds = contactsSnapshot.docs.map(doc => doc.id);
    console.log(`[DEBUG] All contact IDs for userId ${userId}:`, allContactIds.slice(0, 10)); // First 10
    
    const doc = await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .get();

    if (!doc.exists) {
      return NextResponse.json({ 
        found: false,
        message: "Document does not exist in Firestore",
        path: `users/${userId}/contacts/${contactId}`,
        availableContactIds: allContactIds.slice(0, 10), // First 10 for debugging
        totalContacts: allContactIds.length,
      });
    }

    const data = doc.data();
    return NextResponse.json({ 
      found: true,
      contactId: doc.id,
      data: {
        contactId: data?.contactId,
        primaryEmail: data?.primaryEmail,
        firstName: data?.firstName,
        lastName: data?.lastName,
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ 
      error: errorMessage,
      found: false 
    }, { status: 500 });
  }
}

