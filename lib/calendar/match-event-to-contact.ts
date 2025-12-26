import { CalendarEvent } from "@/types/firestore";
import { Contact } from "@/types/firestore";

export interface EventContactMatch {
  contactId: string | null;
  confidence: "high" | "medium" | "low";
  method: "email" | "lastname" | "firstname" | "manual";
  suggestions?: Array<{ contactId: string; confidence: "medium" | "low"; method: string }>;
}

/**
 * Extract names from event, prioritizing attendee names (excluding user's email)
 * Looks for names in attendees first, then falls back to title extraction
 * Excludes names that match the user's name
 */
function extractNamesFromEvent(
  event: CalendarEvent,
  userEmail: string | null
): { firstName: string | null; lastName: string | null } {
  // First, try to extract name from attendees (excluding user's email)
  if (event.attendees && event.attendees.length > 0) {
    for (const attendee of event.attendees) {
      const email = attendee.email.toLowerCase().trim();
      
      // Skip if this is the user's email
      if (userEmail && email === userEmail.toLowerCase().trim()) {
        continue;
      }
      
      // Try to extract name from displayName
      if (attendee.displayName) {
        const nameParts = attendee.displayName.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          // Assume first part is first name, last part is last name
          return {
            firstName: nameParts[0],
            lastName: nameParts[nameParts.length - 1],
          };
        }
      }
    }
  }
  
  // Fallback: Extract from title, but exclude names that match user's name
  const text = event.title || "";
  const namePattern = /([A-Z][a-z]+)\s+([A-Z][a-z]+)/g;
  const matches = Array.from(text.matchAll(namePattern));
  
  // If we have user email, try to extract user's name to exclude it
  let userFirstName: string | null = null;
  let userLastName: string | null = null;
  if (userEmail) {
    // Try to infer user's name from attendees
    const userEmailLower = userEmail.toLowerCase().trim();
    const userAttendee = event.attendees?.find(
      (a) => a.email.toLowerCase().trim() === userEmailLower
    );
    if (userAttendee?.displayName) {
      const userNameParts = userAttendee.displayName.trim().split(/\s+/);
      if (userNameParts.length >= 2) {
        userFirstName = userNameParts[0];
        userLastName = userNameParts[userNameParts.length - 1];
      }
    }
  }
  
  // Return the first name that doesn't match the user's name
  for (const match of matches) {
    const firstName = match[1];
    const lastName = match[2];
    
    // Skip if this matches the user's name (both first and last)
    if (userFirstName && userLastName) {
      if (
        firstName.toLowerCase() === userFirstName.toLowerCase() &&
        lastName.toLowerCase() === userLastName.toLowerCase()
      ) {
        continue;
      }
    }
    // Also skip if just the last name matches (more lenient check)
    if (userLastName && lastName.toLowerCase() === userLastName.toLowerCase()) {
      continue;
    }
    
    return {
      firstName: firstName,
      lastName: lastName,
    };
  }
  
  // If all names matched user, return the first one anyway (fallback)
  if (matches.length > 0) {
    return {
      firstName: matches[0][1],
      lastName: matches[0][2],
    };
  }
  
  return { firstName: null, lastName: null };
}

/**
 * Match event to contact using email (high confidence)
 * Only matches if attendee email exactly matches contact's primaryEmail
 * Excludes the user's own email
 */
function matchByEmail(
  event: CalendarEvent,
  contacts: Contact[],
  userEmail: string | null
): { contactId: string; confidence: "high"; method: "email" } | null {
  if (!event.attendees || event.attendees.length === 0) {
    return null;
  }

  // Check each attendee email against contact primaryEmail and secondaryEmails
  // Exclude the user's own email
  for (const attendee of event.attendees) {
    const email = attendee.email.toLowerCase().trim();
    
    // Skip if this is the user's own email
    if (userEmail && email === userEmail.toLowerCase().trim()) {
      continue;
    }
    
    // Check primaryEmail first
    let contact = contacts.find(
      (c) => c.primaryEmail.toLowerCase().trim() === email
    );

    // If not found, check secondaryEmails
    if (!contact) {
      contact = contacts.find((c) => {
        const primaryMatches = c.primaryEmail.toLowerCase().trim() === email;
        const secondaryMatches = c.secondaryEmails?.some(
          (secondaryEmail) => secondaryEmail.toLowerCase().trim() === email
        );
        return primaryMatches || secondaryMatches;
      });
    }

    if (contact) {
      return {
        contactId: contact.contactId,
        confidence: "high",
        method: "email",
      };
    }
  }

  return null;
}

/**
 * Match event to contact using exact last name (medium confidence)
 * Returns all contacts with matching last name as suggestions
 * Excludes contacts that match the user's email
 */
function matchByLastName(
  event: CalendarEvent,
  contacts: Contact[],
  extractedLastName: string | null,
  userEmail: string | null
): Array<{ contactId: string; confidence: "medium"; method: "lastname" }> {
  if (!extractedLastName) {
    return [];
  }

  const lastNameLower = extractedLastName.toLowerCase().trim();
  const matches: Array<{ contactId: string; confidence: "medium"; method: "lastname" }> = [];

  for (const contact of contacts) {
    // Skip if this contact's email matches the user's email
    if (userEmail && contact.primaryEmail.toLowerCase().trim() === userEmail.toLowerCase().trim()) {
      continue;
    }
    
    if (contact.lastName && contact.lastName.toLowerCase().trim() === lastNameLower) {
      matches.push({
        contactId: contact.contactId,
        confidence: "medium",
        method: "lastname",
      });
    }
  }

  return matches;
}

/**
 * Match event to contact using exact first name (low confidence)
 * Returns all contacts with matching first name as suggestions
 * Excludes contacts that match the user's email
 */
function matchByFirstName(
  event: CalendarEvent,
  contacts: Contact[],
  extractedFirstName: string | null,
  userEmail: string | null
): Array<{ contactId: string; confidence: "low"; method: "firstname" }> {
  if (!extractedFirstName) {
    return [];
  }

  const firstNameLower = extractedFirstName.toLowerCase().trim();
  const matches: Array<{ contactId: string; confidence: "low"; method: "firstname" }> = [];

  for (const contact of contacts) {
    // Skip if this contact's email matches the user's email
    if (userEmail && contact.primaryEmail.toLowerCase().trim() === userEmail.toLowerCase().trim()) {
      continue;
    }
    
    if (contact.firstName && contact.firstName.toLowerCase().trim() === firstNameLower) {
      matches.push({
        contactId: contact.contactId,
        confidence: "low",
        method: "firstname",
      });
    }
  }

  return matches;
}

/**
 * Match a calendar event to a contact
 * Returns the best match and suggestions for lower confidence matches
 * 
 * @param event - The calendar event to match
 * @param contacts - Array of contacts to match against
 * @param userEmail - The signed-in user's email (to exclude from matching)
 */
export function matchEventToContact(
  event: CalendarEvent,
  contacts: Contact[],
  userEmail: string | null = null
): EventContactMatch {
  // Strategy 1: Email match (high confidence) - only auto-link on exact email match
  const emailMatch = matchByEmail(event, contacts, userEmail);
  if (emailMatch) {
    return {
      contactId: emailMatch.contactId,
      confidence: emailMatch.confidence,
      method: emailMatch.method,
    };
  }

  // Strategy 2: Extract names from event (prioritizing attendees, excluding user)
  const { firstName, lastName } = extractNamesFromEvent(event, userEmail);
  
  // Strategy 3: Last name match (medium confidence) - as suggestions only
  const lastNameMatches = matchByLastName(event, contacts, lastName, userEmail);
  
  // Strategy 4: First name match (low confidence) - as suggestions only
  const firstNameMatches = matchByFirstName(event, contacts, firstName, userEmail);
  
  // Combine suggestions (last name matches first, then first name matches)
  const suggestions = [
    ...lastNameMatches.map((m) => ({
      contactId: m.contactId,
      confidence: m.confidence,
      method: m.method,
    })),
    ...firstNameMatches.map((m) => ({
      contactId: m.contactId,
      confidence: m.confidence,
      method: m.method,
    })),
  ];

  // No auto-link, but return suggestions if available
  return {
    contactId: null,
    confidence: "low",
    method: "email", // Default method
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}
