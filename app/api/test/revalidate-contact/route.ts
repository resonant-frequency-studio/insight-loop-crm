import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { isTestMode } from "@/util/test-utils";
import { reportException } from "@/lib/error-reporting";

/**
 * POST /api/test/revalidate-contact
 * Test-only endpoint to invalidate Next.js cache for a contact
 * This is only available in E2E_TEST_MODE to help tests avoid stale cache issues
 * 
 * NOTE: This endpoint does NOT require authentication - it's test-only and guarded by E2E_TEST_MODE
 */
export async function POST(req: Request) {
  // Only allow in test mode - critical security check
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
    const body = await req.json();
    const { userId, contactId } = body;

    if (!userId || !contactId) {
      return NextResponse.json(
        { error: "userId and contactId are required" },
        { status: 400 }
      );
    }

    // Aggressively invalidate all relevant cache tags
    // This ensures that when tests navigate to the contact page,
    // Next.js will fetch fresh data from Firestore instead of using stale cache
    const tags = [
      "contacts",
      `contacts-${userId}`,
      `contact-${userId}-${contactId}`,
      `dashboard-stats-${userId}`,
      // Also invalidate action items cache
      "action-items",
      `action-items-${userId}`,
      `action-items-${userId}-${contactId}`,
    ];

    console.log(`[TEST] Invalidating cache tags:`, tags);
    
    // Invalidate all tags
    tags.forEach(tag => {
      try {
        revalidateTag(tag, "max");
      } catch (error) {
        console.warn(`[TEST] Failed to revalidate tag ${tag}:`, error);
      }
    });

    // Also revalidate the specific path
    try {
      revalidatePath(`/contacts/${encodeURIComponent(contactId)}`);
      revalidatePath(`/api/contacts/${encodeURIComponent(contactId)}`);
    } catch (error) {
      console.warn(`[TEST] Failed to revalidate path:`, error);
    }

    return NextResponse.json({ 
      success: true,
      invalidatedTags: tags,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    reportException(error, {
      context: "Test cache invalidation error",
      tags: { component: "test-revalidate-contact-api" },
    });
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

