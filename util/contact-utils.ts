import { Contact } from "@/types/firestore";
import { Timestamp } from "firebase/firestore";

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

/**
 * Formats a date value from Firestore (Timestamp, Date, or string) into a readable string.
 * 
 * @param date - The date value to format (can be Firestore Timestamp, Date, string, or null)
 * @param options - Options for formatting (relative time, full date, etc.)
 * @returns Formatted date string or "N/A" if date is invalid
 */
export function formatContactDate(
  date: unknown | null,
  options?: { relative?: boolean; includeTime?: boolean }
): string {
  if (!date) return "N/A";

  let dateObj: Date | null = null;

  // Handle ISO date strings (from API - timestamps converted to ISO strings)
  if (typeof date === "string") {
    dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return "N/A";
    }
  }
  // Handle Firestore Timestamp
  else if (date instanceof Timestamp || (typeof date === "object" && date !== null && "toDate" in date)) {
    dateObj = (date as { toDate: () => Date }).toDate();
  }
  // Handle Firestore Timestamp serialized format (from API - legacy format)
  else if (typeof date === "object" && date !== null && "seconds" in date && "nanoseconds" in date) {
    const timestamp = date as { seconds: number; nanoseconds: number };
    dateObj = new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
  }
  // Handle Firestore Timestamp with underscores (alternative serialization)
  else if (typeof date === "object" && date !== null && "_seconds" in date && "_nanoseconds" in date) {
    const timestamp = date as { _seconds: number; _nanoseconds: number };
    dateObj = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
  }
  // Handle JavaScript Date
  else if (date instanceof Date) {
    dateObj = date;
  }
  // Handle number (timestamp in milliseconds)
  else if (typeof date === "number") {
    dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return "N/A";
    }
  }

  if (!dateObj) return "N/A";

  // Relative time option (handles both past and future dates)
  if (options?.relative) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateToCompare = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    
    // Calculate difference in calendar days (positive = past, negative = future)
    const diffMs = today.getTime() - dateToCompare.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Handle future dates (negative diffDays)
    if (diffDays < 0) {
      const absDays = Math.abs(diffDays);
      if (absDays === 0) {
        return "Today";
      } else if (absDays === 1) {
        return "Tomorrow";
      } else if (absDays < 7) {
        return `in ${absDays} days`;
      } else if (absDays < 30) {
        const weeks = Math.floor(absDays / 7);
        return `in ${weeks} ${weeks === 1 ? "week" : "weeks"}`;
      } else if (absDays < 365) {
        const months = Math.floor(absDays / 30);
        return `in ${months} ${months === 1 ? "month" : "months"}`;
      } else {
        const years = Math.floor(absDays / 365);
        return `in ${years} ${years === 1 ? "year" : "years"}`;
      }
    }

    // Handle past dates (positive diffDays)
    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} ${months === 1 ? "month" : "months"} ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} ${years === 1 ? "year" : "years"} ago`;
    }
  }

  // Standard formatting
  if (options?.includeTime) {
    return dateObj.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

