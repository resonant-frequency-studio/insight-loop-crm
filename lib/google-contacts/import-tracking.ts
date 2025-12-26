import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Check if a contact email was previously imported from Google Contacts
 * This prevents re-importing contacts that were deleted/archived by the user
 * 
 * @param userId - User ID
 * @param email - Email address to check (will be normalized)
 * @returns true if contact was previously imported, false otherwise
 */
export async function isContactPreviouslyImported(
  userId: string,
  email: string
): Promise<boolean> {
  if (!email || !email.includes("@")) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const docRef = adminDb
    .collection("users")
    .doc(userId)
    .collection("importedContacts")
    .doc(normalizedEmail);

  const docSnap = await docRef.get();
  return docSnap.exists;
}

/**
 * Mark a contact as imported from Google Contacts
 * This records that the contact was imported, even if it's later deleted
 * 
 * @param userId - User ID
 * @param email - Email address (will be normalized)
 * @param contactId - Contact ID at time of import
 */
export async function markContactAsImported(
  userId: string,
  email: string,
  contactId: string
): Promise<void> {
  if (!email || !email.includes("@")) {
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const docRef = adminDb
    .collection("users")
    .doc(userId)
    .collection("importedContacts")
    .doc(normalizedEmail);

  await docRef.set({
    email: normalizedEmail,
    contactId,
    importedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Batch check multiple emails to see if they were previously imported
 * More efficient than checking one by one
 * 
 * @param userId - User ID
 * @param emails - Array of email addresses to check
 * @returns Map of email -> boolean (true if previously imported)
 */
export async function batchCheckPreviouslyImported(
  userId: string,
  emails: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  
  if (emails.length === 0) {
    return result;
  }

  // Normalize emails
  const normalizedEmails = emails
    .filter(email => email && email.includes("@"))
    .map(email => email.trim().toLowerCase());

  if (normalizedEmails.length === 0) {
    return result;
  }

  // Firestore 'in' query supports up to 10 items
  // Process in batches of 10
  const batchSize = 10;
  for (let i = 0; i < normalizedEmails.length; i += batchSize) {
    const batch = normalizedEmails.slice(i, i + batchSize);
    
    const snapshot = await adminDb
      .collection("users")
      .doc(userId)
      .collection("importedContacts")
      .where("email", "in", batch)
      .get();

    // Mark found emails as previously imported
    snapshot.forEach((doc) => {
      const email = doc.data().email;
      if (email) {
        result.set(email, true);
      }
    });

    // Mark not found emails as not previously imported
    batch.forEach((email) => {
      if (!result.has(email)) {
        result.set(email, false);
      }
    });
  }

  return result;
}

