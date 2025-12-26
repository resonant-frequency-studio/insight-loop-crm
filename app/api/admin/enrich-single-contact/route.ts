import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { contactsPath } from "@/lib/firestore-paths";
import { Contact } from "@/types/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { reportException } from "@/lib/error-reporting";
import { enrichContactFromEmail } from "@/lib/google-people/enrich-contact-from-email";
import { isWellFormedName, extractNamesFromEmail } from "@/util/email-name-extraction";
import { normalizeContactId } from "@/util/csv-utils";

/**
 * POST /api/admin/enrich-single-contact
 * Enrich a single contact by email address using Google People API
 * Request body: { userId: string, email: string, dryRun?: boolean }
 */
export async function POST(request: NextRequest | Request) {
  try {
    const { userId, email, dryRun = false } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const contactId = normalizeContactId(normalizedEmail);

    // Get the contact
    const contactRef = adminDb.collection(contactsPath(userId)).doc(contactId);
    const contactDoc = await contactRef.get();

    if (!contactDoc.exists) {
      return NextResponse.json(
        { error: `Contact with email ${normalizedEmail} not found` },
        { status: 404 }
      );
    }

    const contact = { id: contactDoc.id, ...contactDoc.data() } as Contact & { id: string };

    // Enrich contact using People API
    const enriched = await enrichContactFromEmail(normalizedEmail, userId);

    // Check existing data
    const firstNameWellFormed = isWellFormedName(contact.firstName);
    const lastNameWellFormed = isWellFormedName(contact.lastName);
    const hasCompany = contact.company && contact.company.trim() !== "";
    const hasRealPhoto = contact.photoUrl && 
                         contact.photoUrl.trim() !== "" && 
                         !contact.photoUrl.includes('/cm/');

    // Determine what to update
    // Priority: People API > Existing Firestore > Email Extraction
    const updates: Partial<Contact> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Check if People API returned data
    if (enriched.source === "people_api") {
      // People API is source of truth - prioritize its data
      
      // First name logic
      if (enriched.firstName !== null && enriched.firstName !== undefined) {
        // People API has firstName - use it (add or update)
        updates.firstName = enriched.firstName;
      } else {
        // People API says no firstName - check Firestore, then email extraction
        if (contact.firstName && isWellFormedName(contact.firstName)) {
          // Firestore has well-formed firstName - keep it (don't update)
          // No update needed
        } else {
          // Firestore doesn't have firstName or it's not well-formed - try email extraction
          const extracted = extractNamesFromEmail(normalizedEmail);
          if (extracted.firstName) {
            updates.firstName = extracted.firstName;
          }
        }
      }

      // Last name logic
      if (enriched.lastName !== null && enriched.lastName !== undefined) {
        // People API has lastName - use it (add or update)
        updates.lastName = enriched.lastName;
      } else {
        // People API says no lastName - check Firestore, then email extraction
        if (contact.lastName && isWellFormedName(contact.lastName)) {
          // Firestore has well-formed lastName - keep it (don't update)
          // No update needed
        } else {
          // Firestore doesn't have lastName or it's not well-formed - try email extraction
          const extracted = extractNamesFromEmail(normalizedEmail);
          if (extracted.lastName) {
            updates.lastName = extracted.lastName;
          }
        }
      }

      // Company and photo logic
      if (enriched.company !== null && enriched.company !== undefined) {
        updates.company = enriched.company;
      }

      const needsPhoto = !hasRealPhoto; // Treat default avatars as "no photo"
      if (needsPhoto && enriched.photoUrl) {
        updates.photoUrl = enriched.photoUrl;
      } else if (needsPhoto && !enriched.photoUrl && contact.photoUrl?.includes('/cm/')) {
        // Clear default avatar URLs if no real photo found
        updates.photoUrl = null;
      } else if (contact.photoUrl?.includes('/cm/') && !enriched.photoUrl) {
        // If contact has a /cm/ URL but People API didn't return a photo, clear it
        updates.photoUrl = null;
      }
    } else {
      // People API didn't return data (email_extraction fallback)
      // Only update if fields are missing or not well-formed
      const needsFirstName = !contact.firstName || contact.firstName.trim() === "" || !firstNameWellFormed;
      const needsLastName = !contact.lastName || contact.lastName.trim() === "" || !lastNameWellFormed;
      const needsCompany = !hasCompany;
      const needsPhoto = !hasRealPhoto;

      if (needsFirstName && enriched.firstName) {
        updates.firstName = enriched.firstName;
      }

      if (needsLastName && enriched.lastName) {
        updates.lastName = enriched.lastName;
      }

      if (needsCompany && enriched.company) {
        updates.company = enriched.company;
      }

      if (needsPhoto && enriched.photoUrl) {
        updates.photoUrl = enriched.photoUrl;
      } else if (needsPhoto && !enriched.photoUrl && contact.photoUrl?.includes('/cm/')) {
        // Clear default avatar URLs if no real photo found
        updates.photoUrl = null;
      } else if (contact.photoUrl?.includes('/cm/') && !enriched.photoUrl) {
        // If contact has a /cm/ URL but no photo was found, clear it
        updates.photoUrl = null;
      }
    }

    // Check if there are any updates to make
    const hasUpdates = Object.keys(updates).length > 1; // More than just updatedAt

    if (!hasUpdates) {
      return NextResponse.json({
        success: true,
        message: "No updates needed",
        dryRun,
        contact: {
          email: normalizedEmail,
          contactId: contact.id,
        },
        enriched: {
          ...enriched,
          source: enriched.source || undefined,
        },
        current: {
          firstName: contact.firstName || null,
          lastName: contact.lastName || null,
          company: contact.company || null,
          photoUrl: contact.photoUrl || null,
        },
        action: "skipped",
        reason: "Contact already has all well-formed data",
      });
    }

    if (!dryRun) {
      await contactRef.update(updates);
    }

    return NextResponse.json({
      success: true,
      message: dryRun ? "Preview: Contact would be updated" : "Contact updated successfully",
      dryRun,
      contact: {
        email: normalizedEmail,
        contactId: contact.id,
      },
      enriched: {
        ...enriched,
        source: enriched.source || undefined,
      },
      current: {
        firstName: contact.firstName || null,
        lastName: contact.lastName || null,
        company: contact.company || null,
        photoUrl: contact.photoUrl || null,
      },
      new: {
        firstName: updates.firstName ?? contact.firstName ?? null,
        lastName: updates.lastName ?? contact.lastName ?? null,
        company: updates.company ?? contact.company ?? null,
        photoUrl: updates.photoUrl ?? contact.photoUrl ?? null,
      },
      action: "updated",
      updates: Object.keys(updates).filter(key => key !== "updatedAt"),
    });
  } catch (error) {
    reportException(error, {
      context: "Enriching single contact with People API",
      tags: { component: "enrich-single-contact-api" },
    });
    return NextResponse.json(
      {
        error: "Failed to enrich contact",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

