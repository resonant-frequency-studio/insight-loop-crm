import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { contactsPath } from "@/lib/firestore-paths";
import { Contact } from "@/types/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { reportException } from "@/lib/error-reporting";

/**
 * Extract first and last name from email address
 * 
 * Patterns:
 * - dorothy.adams@yahoo.com -> firstName: "Dorothy", lastName: "Adams"
 * - dorothy@gmail.com -> firstName: "Dorothy", lastName: null
 * - john.doe.smith@example.com -> firstName: "John", lastName: "Doe Smith" (takes first two parts)
 * - jdoe@example.com -> firstName: "Jdoe", lastName: null (single word)
 */
function extractNamesFromEmail(email: string): { firstName: string | null; lastName: string | null } {
  if (!email || !email.includes("@")) {
    return { firstName: null, lastName: null };
  }

  const localPart = email.split("@")[0].toLowerCase();
  
  // Remove common prefixes/suffixes
  const cleaned = localPart
    .replace(/^\+.*?\./, "") // Remove +alias prefixes
    .replace(/\.(gmail|yahoo|hotmail|outlook|icloud)$/i, ""); // Remove domain-like suffixes

  // Split by common separators
  const parts = cleaned.split(/[._-]/).filter(part => part.length > 0);

  if (parts.length === 0) {
    return { firstName: null, lastName: null };
  }

  if (parts.length === 1) {
    // Single part: use as firstName
    return {
      firstName: capitalizeName(parts[0]),
      lastName: null,
    };
  }

  // Multiple parts: first part is firstName, rest is lastName
  const firstName = capitalizeName(parts[0]);
  const lastName = parts.slice(1).map(capitalizeName).join(" ");

  return {
    firstName,
    lastName: lastName || null,
  };
}

/**
 * Capitalize first letter of each word
 */
function capitalizeName(name: string): string {
  if (!name) return "";
  
  return name
    .split(/[\s-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Check if a name is well-formed
 * Well-formed means: uppercase first character, lowercase rest of characters
 * For multi-word names, each word should follow this pattern
 */
function isWellFormedName(name: string | null | undefined): boolean {
  if (!name || name.trim() === "") {
    return false;
  }

  const trimmed = name.trim();
  
  // Split by spaces and hyphens to check each word
  const words = trimmed.split(/[\s-]+/).filter(word => word.length > 0);
  
  if (words.length === 0) {
    return false;
  }

  // Check each word follows the pattern: first char uppercase, rest lowercase
  return words.every(word => {
    if (word.length === 0) return false;
    
    const firstChar = word[0];
    const rest = word.slice(1);
    
    // First character must be uppercase
    if (firstChar !== firstChar.toUpperCase() || firstChar === firstChar.toLowerCase()) {
      return false;
    }
    
    // Rest of characters must be lowercase (if there are any)
    if (rest.length > 0 && rest !== rest.toLowerCase()) {
      return false;
    }
    
    return true;
  });
}

/**
 * Check if we should update the contact
 * Only update if:
 * - firstName is missing/empty OR not well-formed, AND we can extract it, OR
 * - lastName is missing/empty OR not well-formed, AND we can extract it
 * 
 * Do NOT update if both firstName and lastName are well-formed
 */
function shouldUpdateContact(contact: Contact, extracted: { firstName: string | null; lastName: string | null }): boolean {
  const firstNameWellFormed = isWellFormedName(contact.firstName);
  const lastNameWellFormed = isWellFormedName(contact.lastName);
  
  // If both names are well-formed, don't update
  if (firstNameWellFormed && lastNameWellFormed) {
    return false;
  }
  
  const needsFirstName = !contact.firstName || contact.firstName.trim() === "" || !firstNameWellFormed;
  const needsLastName = !contact.lastName || contact.lastName.trim() === "" || !lastNameWellFormed;
  
  const hasFirstName = extracted.firstName !== null;
  const hasLastName = extracted.lastName !== null;

  return (needsFirstName && hasFirstName) || (needsLastName && hasLastName);
}

export async function POST(request: NextRequest) {
  try {
    const { userId, dryRun = false } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Get all contacts for the user
    const contactsRef = adminDb.collection(contactsPath(userId));
    const contactsSnapshot = await contactsRef.get();

    if (contactsSnapshot.empty) {
      return NextResponse.json({
        message: "No contacts found",
        processed: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        details: [],
      });
    }

    const contacts = contactsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as (Contact & { id: string })[];

    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{
        contactId: string;
        email: string;
        action: "updated" | "skipped" | "error";
        extracted?: { firstName: string | null; lastName: string | null };
        current?: { firstName?: string | null; lastName?: string | null };
        new?: { firstName?: string | null; lastName?: string | null };
        error?: string;
      }>,
    };

    // Process contacts in batches
    const batchSize = 10;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (contact) => {
          results.processed++;

          try {
            // Skip contacts that have a company name
            if (contact.company && contact.company.trim() !== "") {
              results.skipped++;
              results.details.push({
                contactId: contact.id,
                email: contact.primaryEmail || "no email",
                action: "skipped",
                current: {
                  firstName: contact.firstName || null,
                  lastName: contact.lastName || null,
                },
                error: "Contact has company name",
              });
              return;
            }

            if (!contact.primaryEmail) {
              results.skipped++;
              results.details.push({
                contactId: contact.id,
                email: contact.primaryEmail || "no email",
                action: "skipped",
                error: "No email address",
              });
              return;
            }

            const extracted = extractNamesFromEmail(contact.primaryEmail);

            // Check why we're skipping (if we are)
            const firstNameWellFormed = isWellFormedName(contact.firstName);
            const lastNameWellFormed = isWellFormedName(contact.lastName);
            const bothWellFormed = firstNameWellFormed && lastNameWellFormed;
            
            if (!shouldUpdateContact(contact, extracted)) {
              results.skipped++;
              results.details.push({
                contactId: contact.id,
                email: contact.primaryEmail,
                action: "skipped",
                extracted,
                current: {
                  firstName: contact.firstName || null,
                  lastName: contact.lastName || null,
                },
                error: bothWellFormed 
                  ? "Both names are well-formed" 
                  : "Email cannot provide needed information",
              });
              return;
            }

            // Determine what to update
            // Only update fields that are missing or not well-formed
            // Note: firstNameWellFormed and lastNameWellFormed are already declared above
            const updates: Partial<Contact> = {
              updatedAt: FieldValue.serverTimestamp(),
            };
            
            const needsFirstName = !contact.firstName || contact.firstName.trim() === "" || !firstNameWellFormed;
            const needsLastName = !contact.lastName || contact.lastName.trim() === "" || !lastNameWellFormed;

            if (needsFirstName && extracted.firstName) {
              updates.firstName = extracted.firstName;
            }

            if (needsLastName && extracted.lastName) {
              updates.lastName = extracted.lastName;
            }

            if (!dryRun) {
              const contactRef = adminDb.collection(contactsPath(userId)).doc(contact.id);
              await contactRef.update(updates);
            }

            results.updated++;
            results.details.push({
              contactId: contact.id,
              email: contact.primaryEmail,
              action: "updated",
              extracted,
              current: {
                firstName: contact.firstName || null,
                lastName: contact.lastName || null,
              },
              new: {
                firstName: updates.firstName || contact.firstName || null,
                lastName: updates.lastName || contact.lastName || null,
              },
            });
          } catch (error) {
            results.errors++;
            results.details.push({
              contactId: contact.id,
              email: contact.primaryEmail || "no email",
              action: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        })
      );
    }

    return NextResponse.json({
      message: dryRun ? "Dry run completed" : "Names extracted and updated",
      dryRun,
      ...results,
    });
  } catch (error) {
    reportException(error, {
      context: "Extracting names from emails",
      tags: { component: "extract-names-api" },
    });
    return NextResponse.json(
      {
        error: "Failed to extract names from emails",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

