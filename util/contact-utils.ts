import { Contact } from "@/types/firestore";

/**
 * Gets the initials for a contact based on their name or email.
 * 
 * Priority:
 * 1. First letter of firstName + first letter of lastName
 * 2. First letter of firstName
 * 3. First letter of primaryEmail
 * 4. "?" as fallback
 */
export function getInitials(contact: Contact): string {
  if (contact.firstName && contact.lastName) {
    return `${contact.firstName[0]}${contact.lastName[0]}`.toUpperCase();
  }
  if (contact.firstName) {
    return contact.firstName[0].toUpperCase();
  }
  if (contact.primaryEmail) {
    return contact.primaryEmail[0].toUpperCase();
  }
  return "?";
}

/**
 * Gets the display name for a contact.
 * 
 * Priority:
 * 1. Full name (firstName + lastName) if either exists
 * 2. Email username (part before @) as fallback
 */
export function getDisplayName(contact: Contact): string {
  if (contact.firstName || contact.lastName) {
    return `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
  }
  return contact.primaryEmail.split("@")[0];
}

