import { getAccessToken } from "@/lib/gmail/get-access-token";
import { getContactFromEmail } from "./get-contact-from-email";
import { extractNamesFromEmail } from "@/util/email-name-extraction";
import { EnrichedContactData } from "./types";
import { reportException, ErrorLevel } from "@/lib/error-reporting";

/**
 * Enrich contact data from email address using Google People API
 * Falls back to email-based name extraction if People API doesn't return name data
 * 
 * @param email - Email address to enrich
 * @param userId - User ID for accessing Google OAuth tokens
 * @returns Enriched contact data with firstName, lastName, company, and source
 */
export async function enrichContactFromEmail(
  email: string,
  userId: string
): Promise<EnrichedContactData> {
  if (!email || !email.includes("@")) {
    // Invalid email, fall back to email extraction
    const extracted = extractNamesFromEmail(email || "");
    return {
      firstName: extracted.firstName,
      lastName: extracted.lastName,
      company: null,
      photoUrl: null,
      source: "email_extraction",
    };
  }

  try {
    // Get access token for People API
    // Note: getAccessToken throws if no account is linked, which we'll catch below
    const accessToken = await getAccessToken(userId);

    // Try People API first
    const peopleApiData = await getContactFromEmail(email, accessToken);

    if (peopleApiData) {
      // Check if People API provided any name data
      const hasPeopleApiNames = 
        (peopleApiData.firstName !== null && peopleApiData.firstName !== undefined) ||
        (peopleApiData.lastName !== null && peopleApiData.lastName !== undefined);
      
      // If People API returned no names at all, fall back to email extraction entirely
      if (!hasPeopleApiNames) {
        const extracted = extractNamesFromEmail(email);
        return {
          firstName: extracted.firstName,
          lastName: extracted.lastName,
          company: peopleApiData.company, // Keep company from People API if available
          photoUrl: peopleApiData.photoUrl, // Keep photo from People API if available
          source: "email_extraction", // No names from People API, so use email extraction
        };
      }
      
      // People API provided at least one name - merge with email extraction for missing names
      const extracted = extractNamesFromEmail(email);
      return {
        firstName: peopleApiData.firstName ?? extracted.firstName, // Use People API firstName or fall back to email extraction
        lastName: peopleApiData.lastName ?? extracted.lastName,     // Use People API lastName or fall back to email extraction
        company: peopleApiData.company,
        photoUrl: peopleApiData.photoUrl,
        source: "people_api", // People API provided at least one name, so mark as people_api
      };
    }

    // People API didn't find the contact, fall back to email extraction
    const extracted = extractNamesFromEmail(email);
    return {
      firstName: extracted.firstName,
      lastName: extracted.lastName,
      company: null,
      photoUrl: null,
      source: "email_extraction",
    };
  } catch (error) {
    // Handle various error cases gracefully
    const errorMessage = error instanceof Error ? error.message : String(error);

    // If no Google account is linked or token is invalid, fall back silently
    if (
      errorMessage.includes("No Gmail account linked") ||
      errorMessage.includes("invalid_grant") ||
      errorMessage.includes("401") ||
      errorMessage.includes("403")
    ) {
      // Log but don't fail - fall back to email extraction
      reportException(error, {
        context: "Google account not linked or invalid token, falling back to email extraction",
        tags: { component: "google-people-enrichment", userId },
        extra: { email },
        level: ErrorLevel.WARNING,
      });

      const extracted = extractNamesFromEmail(email);
      return {
        firstName: extracted.firstName,
        lastName: extracted.lastName,
        company: null,
        photoUrl: null,
        source: "email_extraction",
      };
    }

    // Check if it's a 429 rate limit error - these should be handled by getContactFromEmail
    // but if they slip through, handle gracefully
    if (errorMessage.includes("429") || errorMessage.includes("Too Many Requests")) {
      reportException(error, {
        context: "Rate limit exceeded in People API, falling back to email extraction",
        tags: { component: "google-people-enrichment", userId },
        extra: { email, errorMessage },
        level: ErrorLevel.WARNING,
      });
    } else {
      // For other errors (network, etc.), log but still fall back
      reportException(error, {
        context: "Error enriching contact from People API, falling back to email extraction",
        tags: { component: "google-people-enrichment", userId },
        extra: { email, errorMessage },
        level: ErrorLevel.WARNING,
      });
    }

    // Always fall back to email extraction on error
    const extracted = extractNamesFromEmail(email);
    return {
      firstName: extracted.firstName,
      lastName: extracted.lastName,
      company: null,
      photoUrl: null,
      source: "email_extraction",
    };
  }
}

