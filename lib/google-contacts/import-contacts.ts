import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { listAllContacts } from "@/lib/google-people/list-contacts";
import { PeopleApiPerson } from "@/lib/google-people/types";
import {
  markContactAsImported,
  batchCheckPreviouslyImported,
} from "./import-tracking";
import { normalizeContactId } from "@/util/csv-utils";
import { Contact } from "@/types/firestore";
import { reportException, ErrorLevel } from "@/lib/error-reporting";
import { getUserEmail } from "@/lib/auth-utils";
import { ensureOwnerTag } from "@/lib/contacts/owner-utils";

/**
 * Extract contact data from People API Person resource
 */
function extractContactDataFromPerson(person: PeopleApiPerson): {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  photoUrl: string | null;
} {
  // Extract primary email (required)
  let email: string | null = null;
  if (person.emailAddresses && person.emailAddresses.length > 0) {
    // Use the first email address (usually the primary one)
    email = person.emailAddresses[0]?.value?.trim().toLowerCase() || null;
  }

  // Extract name
  let firstName: string | null = null;
  let lastName: string | null = null;
  if (person.names && person.names.length > 0) {
    const name = person.names[0];
    firstName = name.givenName?.trim() || null;
    lastName = name.familyName?.trim() || null;
  }

  // Extract company from organizations
  let company: string | null = null;
  if (person.organizations && person.organizations.length > 0) {
    const org = person.organizations[0];
    company = org.name?.trim() || null;
  }

  // Extract photo URL - prefer primary photo, fallback to first photo
  // Exclude default/generated avatars
  let photoUrl: string | null = null;
  if (person.photos && person.photos.length > 0) {
    const realPhotos = person.photos.filter(
      (photo) =>
        photo.default !== true &&
        photo.url &&
        !photo.url.includes("/cm/")
    );

    if (realPhotos.length > 0) {
      const primaryPhoto = realPhotos.find(
        (photo) => photo.metadata?.primary === true
      );
      const photoToUse = primaryPhoto || realPhotos[0];
      photoUrl = photoToUse.url?.trim() || null;
    }
  }

  return { email, firstName, lastName, company, photoUrl };
}

/**
 * Import result for a single contact
 */
export interface ContactImportResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  email?: string;
  contactId?: string;
}

/**
 * Batch import results
 */
export interface BatchImportResults {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
  errorDetails: string[];
  importedContactIds: Array<{ contactId: string; email: string }>;
}

/**
 * Import contacts from Google People API
 * Only imports new contacts (skips existing and previously imported)
 * 
 * @param userId - User ID
 * @param accessToken - Google OAuth access token
 * @param batchSize - Number of contacts to process in parallel (default: 10)
 * @param onProgress - Optional progress callback
 * @returns Import statistics
 */
export async function importContactsFromGoogle(
  userId: string,
  accessToken: string,
  batchSize: number = 10,
  onProgress?: (progress: BatchImportResults) => void
): Promise<BatchImportResults> {
  const results: BatchImportResults = {
    imported: 0,
    skipped: 0,
    errors: 0,
    total: 0,
    errorDetails: [],
    importedContactIds: [],
  };

  try {
    // Fetch all contacts from People API
    const allContacts = await listAllContacts(accessToken);
    results.total = allContacts.length;

    if (allContacts.length === 0) {
      return results;
    }

    // Extract emails and check which ones exist or were previously imported
    const contactsWithEmails = allContacts
      .map((person) => {
        const data = extractContactDataFromPerson(person);
        return { person, ...data };
      })
      .filter((contact) => contact.email !== null);

    // Batch check existing contacts
    const emails = contactsWithEmails.map((c) => c.email!);
    const existingContacts = new Set<string>();
    const previouslyImported = await batchCheckPreviouslyImported(userId, emails);

    // Batch check which contacts already exist in Firestore
    // Firestore 'in' query supports up to 10 items, so process in batches
    const emailsToCheck = contactsWithEmails
      .filter((c) => c.email)
      .map((c) => c.email!.toLowerCase());

    const batchSizeCheck = 10;
    for (let i = 0; i < emailsToCheck.length; i += batchSizeCheck) {
      const batch = emailsToCheck.slice(i, i + batchSizeCheck);
      
      const snapshot = await adminDb
        .collection("users")
        .doc(userId)
        .collection("contacts")
        .where("primaryEmail", "in", batch)
        .get();

      snapshot.forEach((doc) => {
        const contact = doc.data() as Contact;
        if (contact.primaryEmail) {
          existingContacts.add(contact.primaryEmail.toLowerCase());
        }
      });
    }

    // Process contacts in batches
    for (let i = 0; i < contactsWithEmails.length; i += batchSize) {
      const batch = contactsWithEmails.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (contact): Promise<ContactImportResult> => {
          const email = contact.email!;

          try {
            // Skip if contact exists
            if (existingContacts.has(email)) {
              return { success: true, skipped: true, email };
            }

            // Skip if previously imported
            if (previouslyImported.get(email)) {
              return { success: true, skipped: true, email };
            }

            // Create new contact
            const contactId = normalizeContactId(email);
            let contactData: Partial<Contact> = {
              contactId,
              primaryEmail: email,
              firstName: contact.firstName,
              lastName: contact.lastName,
              company: contact.company,
              photoUrl: contact.photoUrl,
              tags: [],
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            };

            // Add Owner tag if this is the user's own contact
            const userEmail = await getUserEmail();
            contactData = ensureOwnerTag(contactData, userEmail);

            // Write contact to Firestore
            await adminDb
              .collection("users")
              .doc(userId)
              .collection("contacts")
              .doc(contactId)
              .set(contactData);

            // Mark as imported
            await markContactAsImported(userId, email, contactId);

            return { success: true, email, contactId };
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            reportException(error, {
              context: "Error importing contact from Google Contacts",
              tags: { component: "google-contacts-import", userId, email },
              level: ErrorLevel.WARNING,
            });
            return {
              success: false,
              reason: errorMsg,
              email,
            };
          }
        })
      );

      // Aggregate results
      batchResults.forEach((result) => {
        if (result.success) {
          if (result.skipped) {
            results.skipped++;
          } else {
            results.imported++;
            // Track imported contact IDs for Gmail sync and insights generation
            if (result.email && result.contactId) {
              results.importedContactIds.push({
                contactId: result.contactId,
                email: result.email,
              });
            }
          }
        } else {
          results.errors++;
          const email = result.email || "Unknown";
          results.errorDetails.push(`${email}: ${result.reason || "Unknown error"}`);
        }
      });

      // Report progress
      if (onProgress) {
        onProgress({ ...results });
      }

      // Small delay between batches to avoid overwhelming Firestore
      if (i + batchSize < contactsWithEmails.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    reportException(error, {
      context: "Error importing contacts from Google Contacts",
      tags: { component: "google-contacts-import", userId },
    });
    throw new Error(`Failed to import contacts: ${errorMsg}`);
  }
}

