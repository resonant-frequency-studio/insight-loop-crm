import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { getContactForUser } from "@/lib/contacts-server";
import { reportException } from "@/lib/error-reporting";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";

/**
 * GET /api/contacts/[contactId]
 * Get a single contact for the authenticated user
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const userId = await getUserId();
    const { contactId: contactIdParam } = await params;
    const contactId = decodeURIComponent(contactIdParam);
    
    const contact = await getContactForUser(userId, contactId);
    
    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ contact });
  } catch (error) {
    reportException(error, {
      context: "Fetching contact",
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
 * PATCH /api/contacts/[contactId]
 * Update a contact for the authenticated user
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
    const updates = body;

    // Validate that contact exists
    const existingContact = await getContactForUser(userId, contactId);
    if (!existingContact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Update contact using server-side Firestore
    await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .update({
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
      });

    // Invalidate Next.js server cache
    revalidateTag("contacts", "max");
    revalidateTag(`contacts-${userId}`, "max");
    revalidateTag(`contact-${userId}-${contactId}`, "max");
    revalidateTag(`dashboard-stats-${userId}`, "max");

    return NextResponse.json({ success: true });
  } catch (error) {
    reportException(error, {
      context: "Updating contact",
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
 * DELETE /api/contacts/[contactId]
 * Delete a contact for the authenticated user
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const userId = await getUserId();
    const { contactId: contactIdParam } = await params;
    const contactId = decodeURIComponent(contactIdParam);

    // Validate that contact exists
    const existingContact = await getContactForUser(userId, contactId);
    if (!existingContact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Delete contact document
    await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .delete();

    // Invalidate Next.js server cache
    revalidateTag("contacts", "max");
    revalidateTag(`contacts-${userId}`, "max");
    revalidateTag(`contact-${userId}-${contactId}`, "max");
    revalidateTag(`dashboard-stats-${userId}`, "max");

    return NextResponse.json({ success: true });
  } catch (error) {
    reportException(error, {
      context: "Deleting contact",
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

