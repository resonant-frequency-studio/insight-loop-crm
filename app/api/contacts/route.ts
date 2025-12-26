import { NextResponse } from "next/server";
import { getUserId, getUserEmail } from "@/lib/auth-utils";
import { getAllContactsForUserUncached } from "@/lib/contacts-server";
import { reportException } from "@/lib/error-reporting";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { normalizeContactId } from "@/util/csv-utils";
import { Contact } from "@/types/firestore";
import { revalidateTag } from "next/cache";
import { ensureOwnerTag } from "@/lib/contacts/owner-utils";

// Force dynamic rendering - never cache this route
export const dynamic = "force-dynamic";

/**
 * GET /api/contacts
 * Get all contacts for the authenticated user
 * Bypasses Next.js cache to always fetch fresh data from Firestore
 */
export async function GET() {
  try {
    const userId = await getUserId();
    // Force no-store at route level - bypass all caching
    return NextResponse.json(
      { contacts: await getAllContactsForUserUncached(userId) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    reportException(error, {
      context: "Fetching contacts",
      tags: { component: "contacts-api" },
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contacts
 * Create a new contact for the authenticated user
 */
export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const contactData = body as Partial<Contact>;

    // Validate required fields
    if (!contactData.primaryEmail) {
      return NextResponse.json(
        { error: "primaryEmail is required" },
        { status: 400 }
      );
    }

    // Normalize email and generate contactId
    const email = contactData.primaryEmail.trim().toLowerCase();
    const contactId = normalizeContactId(email);

    // Check if contact already exists
    const existingDoc = await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .get();

    if (existingDoc.exists) {
      return NextResponse.json(
        { error: "Contact with this email already exists" },
        { status: 409 }
      );
    }

    // Remove contactId from contactData if present to ensure it matches document ID
    const { contactId: _, ...contactDataWithoutId } = contactData;

    // Ensure Owner tag is added if this is the user's own contact
    const userEmail = await getUserEmail();
    const contactWithOwnerTag = ensureOwnerTag(
      {
        ...contactDataWithoutId,
        primaryEmail: email,
      },
      userEmail
    );

    // Create contact
    // IMPORTANT: contactId in data must match document ID for real-time listener to work correctly
    await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .set({
        ...contactWithOwnerTag,
        contactId, // Ensure contactId matches document ID
        primaryEmail: email,
        archived: false, // Explicitly set archived to false for new contacts
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    // Invalidate Next.js server cache
    revalidateTag("contacts", "max");
    revalidateTag(`contacts-${userId}`, "max");
    revalidateTag(`contact-${userId}-${contactId}`, "max");
    revalidateTag(`dashboard-stats-${userId}`, "max");

    return NextResponse.json({ success: true, contactId });
  } catch (error) {
    reportException(error, {
      context: "Creating contact",
      tags: { component: "contacts-api" },
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

