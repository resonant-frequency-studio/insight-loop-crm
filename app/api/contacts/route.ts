import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { getAllContactsForUser } from "@/lib/contacts-server";
import { reportException } from "@/lib/error-reporting";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { normalizeContactId } from "@/util/csv-utils";
import { Contact } from "@/types/firestore";
import { revalidateTag } from "next/cache";

/**
 * GET /api/contacts
 * Get all contacts for the authenticated user
 */
export async function GET() {
  try {
    const userId = await getUserId();
    const contacts = await getAllContactsForUser(userId);
    return NextResponse.json({ contacts });
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

    // Create contact
    await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .set({
        ...contactData,
        contactId,
        primaryEmail: email,
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

