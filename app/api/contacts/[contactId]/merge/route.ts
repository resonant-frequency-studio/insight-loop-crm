import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { getContactForUser } from "@/lib/contacts-server";
import { mergeContacts } from "@/lib/contacts/merge-contacts";
import { reportException } from "@/lib/error-reporting";
import { ErrorLevel } from "@/lib/error-reporting";
import { revalidateTag } from "next/cache";

/**
 * POST /api/contacts/[contactId]/merge
 * Merge multiple contacts into a single primary contact
 * Request body: { contactIdsToMerge: string[], primaryEmail: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const userId = await getUserId();
    const { contactId: contactIdParam } = await params;
    const primaryContactId = decodeURIComponent(contactIdParam);
    const body = await req.json();

    const { contactIdsToMerge, primaryEmail } = body;

    // Validate request body
    if (!Array.isArray(contactIdsToMerge) || contactIdsToMerge.length === 0) {
      return NextResponse.json(
        { error: "contactIdsToMerge must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!primaryEmail || typeof primaryEmail !== "string" || primaryEmail.trim() === "") {
      return NextResponse.json(
        { error: "primaryEmail is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Prevent merging a contact into itself
    if (contactIdsToMerge.includes(primaryContactId)) {
      return NextResponse.json(
        { error: "Cannot merge a contact into itself" },
        { status: 400 }
      );
    }

    // Validate that primary contact exists and user has access
    const primaryContact = await getContactForUser(userId, primaryContactId);
    if (!primaryContact) {
      return NextResponse.json(
        { error: "Primary contact not found" },
        { status: 404 }
      );
    }

    // Validate that all contacts to merge exist and user has access
    for (const contactId of contactIdsToMerge) {
      const contact = await getContactForUser(userId, contactId);
      if (!contact) {
        return NextResponse.json(
          { error: `Contact ${contactId} not found` },
          { status: 404 }
        );
      }
    }

    // Perform the merge
    const result = await mergeContacts(
      userId,
      primaryContactId,
      contactIdsToMerge,
      primaryEmail.trim()
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Merge failed" },
        { status: 500 }
      );
    }

    // Invalidate cache
    revalidateTag(`contacts-${userId}`, "max");
    revalidateTag(`contact-${userId}-${primaryContactId}`, "max");

    return NextResponse.json({
      success: true,
      primaryContactId: result.primaryContactId,
      mergedContactIds: result.mergedContactIds,
      statistics: result.statistics,
    });
  } catch (error) {
    reportException(error, {
      context: "Error in merge contacts API",
      tags: { component: "merge-contacts-api" },
      level: ErrorLevel.ERROR,
    });

    const errorMessage =
      error instanceof Error ? error.message : "Failed to merge contacts";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

