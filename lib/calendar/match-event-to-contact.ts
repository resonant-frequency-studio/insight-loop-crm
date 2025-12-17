import { CalendarEvent } from "@/types/firestore";
import { Contact } from "@/types/firestore";

export interface EventContactMatch {
  contactId: string | null;
  confidence: "high" | "medium" | "low";
  method: "email" | "name" | "domain" | "manual";
  suggestions?: Array<{ contactId: string; confidence: "medium" | "low"; method: string }>;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy name matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate string similarity (0-1, where 1 is identical)
 */
function stringSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Extract potential names from event title and description
 */
function extractNamesFromEvent(event: CalendarEvent): string[] {
  const names: string[] = [];
  const text = `${event.title} ${event.description || ""}`.toLowerCase();

  // Simple pattern: Look for "with {name}" or "{name} meeting" patterns
  const patterns = [
    /(?:with|meeting with|call with)\s+([a-z]+(?:\s+[a-z]+)?)/gi,
    /([A-Z][a-z]+\s+[A-Z][a-z]+)/g, // Capitalized first and last name
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        names.push(match[1].trim());
      }
    }
  }

  return names;
}

/**
 * Match event to contact using email (high confidence)
 */
function matchByEmail(
  event: CalendarEvent,
  contacts: Contact[]
): { contactId: string; confidence: "high"; method: "email" } | null {
  if (!event.attendees || event.attendees.length === 0) {
    return null;
  }

  // Check each attendee email against contact primaryEmail
  for (const attendee of event.attendees) {
    const email = attendee.email.toLowerCase().trim();
    const contact = contacts.find(
      (c) => c.primaryEmail.toLowerCase().trim() === email
    );

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
 * Match event to contact using name (medium confidence)
 */
function matchByName(
  event: CalendarEvent,
  contacts: Contact[]
): { contactId: string; confidence: "medium"; method: "name" } | null {
  const extractedNames = extractNamesFromEvent(event);
  if (extractedNames.length === 0) {
    return null;
  }

  const threshold = 0.8; // 80% similarity required

  for (const extractedName of extractedNames) {
    for (const contact of contacts) {
      const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
      if (!fullName) continue;

      const similarity = stringSimilarity(extractedName, fullName);
      if (similarity >= threshold) {
        return {
          contactId: contact.contactId,
          confidence: "medium",
          method: "name",
        };
      }
    }
  }

  return null;
}

/**
 * Match event to contact using domain (low confidence)
 */
function matchByDomain(
  event: CalendarEvent,
  contacts: Contact[]
): Array<{ contactId: string; confidence: "low"; method: "domain" }> {
  if (!event.attendees || event.attendees.length === 0) {
    return [];
  }

  const domainMatches: Array<{ contactId: string; confidence: "low"; method: "domain" }> = [];
  const seenContactIds = new Set<string>();

  // Extract domains from attendee emails
  const attendeeDomains = new Set<string>();
  for (const attendee of event.attendees) {
    const email = attendee.email.toLowerCase().trim();
    const domain = email.split("@")[1];
    if (domain) {
      attendeeDomains.add(domain);
    }
  }

  // Match contacts by email domain
  for (const contact of contacts) {
    if (seenContactIds.has(contact.contactId)) continue;

    const contactEmail = contact.primaryEmail.toLowerCase().trim();
    const contactDomain = contactEmail.split("@")[1];
    if (contactDomain && attendeeDomains.has(contactDomain)) {
      domainMatches.push({
        contactId: contact.contactId,
        confidence: "low",
        method: "domain",
      });
      seenContactIds.add(contact.contactId);
    }
  }

  return domainMatches;
}

/**
 * Match a calendar event to a contact
 * Returns the best match and suggestions for lower confidence matches
 */
export function matchEventToContact(
  event: CalendarEvent,
  contacts: Contact[]
): EventContactMatch {
  // Strategy 1: Email match (high confidence) - return immediately if found
  const emailMatch = matchByEmail(event, contacts);
  if (emailMatch) {
    return {
      contactId: emailMatch.contactId,
      confidence: emailMatch.confidence,
      method: emailMatch.method,
    };
  }

  // Strategy 2: Name match (medium confidence)
  const nameMatch = matchByName(event, contacts);
  if (nameMatch) {
    // Collect domain matches as suggestions
    const domainMatches = matchByDomain(event, contacts);
    return {
      contactId: nameMatch.contactId,
      confidence: nameMatch.confidence,
      method: nameMatch.method,
      suggestions: domainMatches.map((m) => ({
        contactId: m.contactId,
        confidence: m.confidence,
        method: m.method,
      })),
    };
  }

  // Strategy 3: Domain match (low confidence) - return first as match, rest as suggestions
  const domainMatches = matchByDomain(event, contacts);
  if (domainMatches.length > 0) {
    const [firstMatch, ...restMatches] = domainMatches;
    return {
      contactId: firstMatch.contactId,
      confidence: firstMatch.confidence,
      method: firstMatch.method,
      suggestions: restMatches.map((m) => ({
        contactId: m.contactId,
        confidence: m.confidence,
        method: m.method,
      })),
    };
  }

  // No match found
  return {
    contactId: null,
    confidence: "low",
    method: "email", // Default method
  };
}

