import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { Contact } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";
import { ErrorLevel } from "@/lib/error-reporting";

/**
 * GET /api/contacts/search
 * Search contacts by firstName, lastName, or primaryEmail
 * Query params: q (search query), excludeContactId (optional - contact to exclude from results)
 */
export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const url = new URL(req.url);
    const query = url.searchParams.get("q");
    const excludeContactId = url.searchParams.get("excludeContactId");

    if (!query || query.trim() === "") {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    const searchTerm = query.trim().toLowerCase();
    const limit = 20;

    // Get all contacts for the user
    const contactsSnapshot = await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .get();

    // Filter contacts by search term
    const matchingContacts: Array<{
      contactId: string;
      firstName: string | null;
      lastName: string | null;
      primaryEmail: string;
      secondaryEmails?: string[];
      photoUrl: string | null;
    }> = [];

    for (const doc of contactsSnapshot.docs) {
      // Exclude the current contact if specified
      if (excludeContactId && doc.id === excludeContactId) {
        continue;
      }

      const contact = doc.data() as Contact;

      // Exclude archived contacts
      if (contact.archived === true) {
        continue;
      }

      // Check if search term matches firstName, lastName, or primaryEmail
      const firstNameMatch =
        contact.firstName &&
        contact.firstName.toLowerCase().includes(searchTerm);
      const lastNameMatch =
        contact.lastName &&
        contact.lastName.toLowerCase().includes(searchTerm);
      const emailMatch =
        contact.primaryEmail &&
        contact.primaryEmail.toLowerCase().includes(searchTerm);

      if (firstNameMatch || lastNameMatch || emailMatch) {
        matchingContacts.push({
          contactId: doc.id,
          firstName: contact.firstName || null,
          lastName: contact.lastName || null,
          primaryEmail: contact.primaryEmail,
          secondaryEmails: contact.secondaryEmails || undefined,
          photoUrl: contact.photoUrl || null,
        });

        // Limit results
        if (matchingContacts.length >= limit) {
          break;
        }
      }
    }

    return NextResponse.json({
      contacts: matchingContacts,
      count: matchingContacts.length,
    });
  } catch (error) {
    reportException(error, {
      context: "Error searching contacts",
      tags: { component: "contacts-search-api" },
      level: ErrorLevel.ERROR,
    });

    const errorMessage =
      error instanceof Error ? error.message : "Failed to search contacts";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

