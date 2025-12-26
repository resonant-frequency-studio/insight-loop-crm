import {
  PeopleApiSearchContactsResponse,
  PeopleApiOtherContactsSearchResponse,
  PeopleApiPerson,
  EnrichedContactData,
} from "./types";
import { reportException, ErrorLevel } from "@/lib/error-reporting";

/**
 * Extract first name, last name, company, and photo from a People API Person resource
 */
function extractContactDataFromPerson(person: PeopleApiPerson | undefined): {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  photoUrl: string | null;
} {
  if (!person) {
    return { firstName: null, lastName: null, company: null, photoUrl: null };
  }

  // Extract name
  let firstName: string | null = null;
  let lastName: string | null = null;

  if (person.names && person.names.length > 0) {
    // Use the first name entry (usually the primary name)
    const name = person.names[0];
    firstName = name.givenName?.trim() || null;
    lastName = name.familyName?.trim() || null;
  }

  // Extract company from organizations
  let company: string | null = null;
  if (person.organizations && person.organizations.length > 0) {
    // Use the first organization entry
    const org = person.organizations[0];
    company = org.name?.trim() || null;
  }

  // Extract photo URL - prefer primary photo, fallback to first photo
  // BUT exclude default/generated avatars (default: true means it's a generated avatar)
  // Also exclude URLs with /cm/ path which are Google-generated avatars
  let photoUrl: string | null = null;
  if (person.photos && person.photos.length > 0) {
    // Filter out default/generated avatars - these are just initials, not real photos
    // Check both the default flag AND the /cm/ path pattern
    const realPhotos = person.photos.filter(
      (photo) => 
        photo.default !== true && 
        photo.url && 
        !photo.url.includes('/cm/') // Filter out /cm/ URLs directly in the filter
    );
    
    if (realPhotos.length > 0) {
      // Try to find primary photo first
      const primaryPhoto = realPhotos.find(
        (photo) => photo.metadata?.primary === true
      );
      const photoToUse = primaryPhoto || realPhotos[0];
      photoUrl = photoToUse.url?.trim() || null;
      
      // Additional safety check: filter out URLs that are clearly generated avatars
      // Google uses /cm/ path for generated avatars with initials
      // (This is redundant now but kept as a safety net)
      if (photoUrl && photoUrl.includes('/cm/')) {
        photoUrl = null;
      }
    }
  }

  return { firstName, lastName, company, photoUrl };
}

/**
 * Retry helper with exponential backoff
 * Handles 429 rate limit errors with longer delays
 * Returns null for 429 errors after retries instead of throwing
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T | null> {
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Extract response if available (for 429 errors)
      if (error && typeof error === 'object' && 'response' in error) {
        lastResponse = (error as { response?: Response }).response || null;
      }
      
      // Extract status code from response if available
      const status = lastResponse?.status;
      
      // Don't retry on 400, 401, 403, 404 errors (non-retryable)
      if (
        status === 400 || status === 401 || status === 403 || status === 404 ||
        lastError.message.includes("400") ||
        lastError.message.includes("404") ||
        lastError.message.includes("403") ||
        lastError.message.includes("401") ||
        lastError.message.includes("Bad Request") ||
        lastError.message.includes("Forbidden")
      ) {
        // For 400 and 403, return null to indicate we should skip this endpoint
        if (status === 400 || status === 403 || 
            lastError.message.includes("400") || lastError.message.includes("403") ||
            lastError.message.includes("Bad Request") || lastError.message.includes("Forbidden")) {
          return null;
        }
        throw lastError;
      }

      // Check if it's a 429 rate limit error
      const isRateLimit = lastError.message.includes("429") || lastResponse?.status === 429;
      
      // For 429 errors after all retries, return null instead of throwing
      if (isRateLimit && attempt === maxRetries) {
        return null;
      }

      // Don't retry on last attempt (unless it's a 429 which we handle above)
      if (attempt === maxRetries) {
        throw lastError;
      }

      // For 429 errors, use longer delays and check Retry-After header
      let delay = initialDelay * Math.pow(2, attempt);
      
      if (isRateLimit) {
        // Check for Retry-After header (in seconds)
        const retryAfter = lastResponse?.headers.get("Retry-After");
        if (retryAfter) {
          const retrySeconds = parseInt(retryAfter, 10);
          if (!isNaN(retrySeconds)) {
            delay = retrySeconds * 1000; // Convert to milliseconds
          } else {
            // If Retry-After is not a number, use longer exponential backoff
            delay = Math.max(delay, 10000 * Math.pow(2, attempt)); // Start with 10 seconds for 429
          }
        } else {
          // No Retry-After header, use longer exponential backoff
          delay = Math.max(delay, 10000 * Math.pow(2, attempt)); // Start with 10 seconds for 429
        }
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Unknown error");
}

/**
 * Get full person details using people.get endpoint
 * This is needed to get real photos (not just default avatars)
 * The searchContacts endpoint may only return limited photo data
 */
async function getPersonDetails(
  resourceName: string,
  accessToken: string
): Promise<PeopleApiPerson | null> {
  const personFields = "names,emailAddresses,organizations,photos";
  const url = `https://people.googleapis.com/v1/${resourceName}?personFields=${encodeURIComponent(personFields)}`;

  try {
    const response = await retryWithBackoff(async () => {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        const error = new Error(`People API getPersonDetails failed: ${res.status} ${res.statusText}`);
        (error as Error & { response?: Response }).response = res;
        throw error;
      }

      return res;
    });

    if (!response) {
      return null;
    }

    const person: PeopleApiPerson = await response.json();
    return person;
  } catch (error) {
    // Log but don't throw - fall back to searchContacts data
    if (error instanceof Error && !error.message.includes("404")) {
      reportException(error, {
        context: "Error getting full person details from People API",
        tags: { component: "google-people", endpoint: "people.get" },
        extra: { resourceName },
        level: ErrorLevel.WARNING,
      });
    }
    return null;
  }
}

/**
 * Search user's contacts using People API searchContacts endpoint
 */
async function searchContacts(
  email: string,
  accessToken: string
): Promise<EnrichedContactData | null> {
  const readMask = "names,emailAddresses,organizations,photos";
  const url = `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(
    email
  )}&readMask=${encodeURIComponent(readMask)}`;

  try {
    const response = await retryWithBackoff(async () => {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (res.status === 404) {
        return null; // Not found, return null to try otherContacts
      }

      if (!res.ok) {
        const error = new Error(`People API searchContacts failed: ${res.status} ${res.statusText}`);
        // Attach response to error for retry logic
        (error as Error & { response?: Response }).response = res;
        throw error;
      }

      return res;
    });

    // If retryWithBackoff returns null, it means we hit rate limits
    if (!response) {
      return null; // Rate limited or not found
    }

    const data: PeopleApiSearchContactsResponse = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    // Get the person from search result
    const searchResultPerson = data.results[0]?.person;
    if (!searchResultPerson || !searchResultPerson.resourceName) {
      return null;
    }

    // Get full person details using people.get to get real photos
    // searchContacts may only return default avatars, but people.get returns real photos
    const fullPerson = await getPersonDetails(searchResultPerson.resourceName, accessToken);
    
    // Use full person details if available, otherwise fall back to search result
    const person = fullPerson || searchResultPerson;
    const extracted = extractContactDataFromPerson(person);

    return {
      ...extracted,
      source: "people_api" as const,
    };
  } catch (error) {
    // If it's a 404 or not found, return null to try otherContacts
    if (
      error instanceof Error &&
      (error.message.includes("404") || error.message.includes("Not found"))
    ) {
      return null;
    }

    // For 429 rate limit errors, return null to gracefully fall back to email extraction
    // This should rarely happen now since retryWithBackoff returns null for 429s, but keep as safety net
    if (
      error instanceof Error &&
      (error.message.includes("429") || error.message.includes("Too Many Requests"))
    ) {
      reportException(error, {
        context: "Rate limit exceeded in People API searchContacts, falling back to email extraction",
        tags: { component: "google-people", endpoint: "searchContacts" },
        extra: { email },
        level: ErrorLevel.WARNING,
      });
      return null; // Gracefully fall back instead of throwing
    }

    // For other errors, log and rethrow
    reportException(error, {
      context: "Error searching contacts in People API",
      tags: { component: "google-people", endpoint: "searchContacts" },
      extra: { email },
    });
    throw error;
  }
}

/**
 * Search "Other Contacts" using People API otherContacts.search endpoint
 */
async function searchOtherContacts(
  email: string,
  accessToken: string
): Promise<EnrichedContactData | null> {
  // Note: otherContacts.search only supports: emailAddresses, metadata, names, phoneNumbers
  // organizations is NOT supported for this endpoint, so we exclude it
  const readMask = "names,emailAddresses";
  const url = `https://people.googleapis.com/v1/otherContacts:search?query=${encodeURIComponent(
    email
  )}&readMask=${encodeURIComponent(readMask)}`;

  try {
    const response = await retryWithBackoff(async () => {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (res.status === 404) {
        return null; // Not found
      }

      // Handle 400 (Bad Request) and 403 (Forbidden) errors gracefully
      // These indicate the endpoint might not be available, have wrong parameters, or insufficient scope
      if (res.status === 400 || res.status === 403) {
        // Try to read error body for more details
        let errorDetails = "";
        try {
          const errorBody = await res.clone().json().catch(() => ({}));
          errorDetails = JSON.stringify(errorBody);
        } catch {
          // Ignore JSON parse errors
        }
        
        const error = new Error(
          `People API otherContacts.search failed: ${res.status} ${res.statusText}${errorDetails ? ` - ${errorDetails}` : ""}`
        );
        // Attach response to error for logging
        (error as Error & { response?: Response }).response = res;
        // Return null instead of throwing - these are non-retryable errors
        return null;
      }

      if (!res.ok) {
        const error = new Error(
          `People API otherContacts.search failed: ${res.status} ${res.statusText}`
        );
        // Attach response to error for retry logic
        (error as Error & { response?: Response }).response = res;
        throw error;
      }

      return res;
    });

    // If retryWithBackoff returns null, it means we hit rate limits
    if (!response) {
      return null; // Rate limited or not found
    }

    const data: PeopleApiOtherContactsSearchResponse = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    // Get the person from search result
    const searchResultPerson = data.results[0]?.person;
    if (!searchResultPerson || !searchResultPerson.resourceName) {
      return null;
    }

    // Get full person details using people.get to get real photos
    // Note: otherContacts might not have photos, but try anyway
    const fullPerson = await getPersonDetails(searchResultPerson.resourceName, accessToken);
    
    // Use full person details if available, otherwise fall back to search result
    const person = fullPerson || searchResultPerson;
    const extracted = extractContactDataFromPerson(person);

    return {
      ...extracted,
      source: "people_api" as const,
    };
  } catch (error) {
    // If it's a 404 or not found, return null (no more fallbacks)
    if (
      error instanceof Error &&
      (error.message.includes("404") || error.message.includes("Not found"))
    ) {
      return null;
    }

    // For 400 (Bad Request) and 403 (Forbidden) errors, return null gracefully
    // These indicate the endpoint might not be available or have wrong parameters
    if (
      error instanceof Error &&
      (error.message.includes("400") || error.message.includes("403") || 
       error.message.includes("Bad Request") || error.message.includes("Forbidden") ||
       error.message.includes("insufficient_scope"))
    ) {
      reportException(error, {
        context: "otherContacts.search endpoint unavailable or insufficient scope (400/403), skipping",
        tags: { component: "google-people", endpoint: "otherContacts.search" },
        extra: { email },
        level: ErrorLevel.WARNING,
      });
      return null; // Gracefully skip otherContacts if endpoint unavailable
    }

    // For 429 rate limit errors, return null to gracefully fall back to email extraction
    // This should rarely happen now since retryWithBackoff returns null for 429s, but keep as safety net
    if (
      error instanceof Error &&
      (error.message.includes("429") || error.message.includes("Too Many Requests"))
    ) {
      reportException(error, {
        context: "Rate limit exceeded in People API otherContacts.search, falling back to email extraction",
        tags: { component: "google-people", endpoint: "otherContacts.search" },
        extra: { email },
        level: ErrorLevel.WARNING,
      });
      return null; // Gracefully fall back instead of throwing
    }

    // For other errors, log and rethrow
    reportException(error, {
      context: "Error searching other contacts in People API",
      tags: { component: "google-people", endpoint: "otherContacts.search" },
      extra: { email },
    });
    throw error;
  }
}

/**
 * Get contact information from Google People API using email address
 * 
 * Tries two endpoints:
 * 1. people.searchContacts - searches user's contacts
 * 2. otherContacts.search - searches "Other Contacts" if first search fails
 * 
 * @param email - Email address to search for
 * @param accessToken - Google OAuth access token
 * @returns Enriched contact data or null if not found or rate limited
 * @throws Error if API call fails (excluding 404/not found and 429 rate limit errors)
 */
export async function getContactFromEmail(
  email: string,
  accessToken: string
): Promise<EnrichedContactData | null> {
  if (!email || !email.includes("@")) {
    return null;
  }

  // Normalize email to lowercase
  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Try searchContacts first (user's contacts)
    const contactData = await searchContacts(normalizedEmail, accessToken);
    if (contactData) {
      return contactData;
    }

    // If not found, try otherContacts
    const otherContactData = await searchOtherContacts(normalizedEmail, accessToken);
    if (otherContactData) {
      return otherContactData;
    }

    // Not found in either source
    return null;
  } catch (error) {
    // If it's a 429 rate limit error, return null to gracefully fall back
    if (
      error instanceof Error &&
      error.message.includes("429")
    ) {
      reportException(error, {
        context: "Rate limit exceeded in People API getContactFromEmail, falling back to email extraction",
        tags: { component: "google-people", endpoint: "getContactFromEmail" },
        extra: { email },
        level: ErrorLevel.WARNING,
      });
      return null;
    }
    
    // For other errors, rethrow
    throw error;
  }
}

