import { Contact } from "@/types/firestore";

/**
 * Normalize email address for comparison (lowercase, trim)
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Check if a contact is the owner (user's own contact)
 * @param userEmail - User's email address (can be null if unavailable)
 * @param contactEmail - Contact's email address
 * @returns true if the contact email matches the user email
 */
export function isOwnerContact(userEmail: string | null, contactEmail: string): boolean {
  if (!userEmail || !contactEmail) {
    return false;
  }
  return normalizeEmail(userEmail) === normalizeEmail(contactEmail);
}

/**
 * Ensure "Owner" tag is present or removed based on email match
 * Adds "Owner" tag if email matches user, removes it if it doesn't
 * @param contact - Contact data (partial)
 * @param userEmail - User's email address (can be null if unavailable)
 * @returns Updated contact data with correct Owner tag
 */
export function ensureOwnerTag(contact: Partial<Contact>, userEmail: string | null): Partial<Contact> {
  if (!contact.primaryEmail) {
    return contact;
  }

  const isOwner = isOwnerContact(userEmail, contact.primaryEmail);
  const currentTags = contact.tags || [];
  const hasOwnerTag = currentTags.includes("Owner");

  if (isOwner && !hasOwnerTag) {
    // Add Owner tag
    return {
      ...contact,
      tags: [...currentTags, "Owner"],
    };
  } else if (!isOwner && hasOwnerTag) {
    // Remove Owner tag
    return {
      ...contact,
      tags: currentTags.filter((tag) => tag !== "Owner"),
    };
  }

  // No change needed
  return contact;
}

