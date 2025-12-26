import { PeopleApiPerson } from "./types";
import { reportException, ErrorLevel } from "@/lib/error-reporting";

/**
 * Google People API connections.list response
 */
interface PeopleApiConnectionsListResponse {
  connections?: PeopleApiPerson[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

/**
 * Retry helper with exponential backoff
 * Handles 429 rate limit errors with longer delays
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
        throw lastError;
      }

      // Check if it's a 429 rate limit error
      const isRateLimit = lastError.message.includes("429") || lastResponse?.status === 429;
      
      // For 429 errors after all retries, throw error
      if (isRateLimit && attempt === maxRetries) {
        throw lastError;
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
 * List all contacts from Google People API
 * Uses people.connections.list endpoint with pagination
 * 
 * @param accessToken - Google OAuth access token
 * @param personFields - Fields to request (default: names,emailAddresses,organizations,photos)
 * @returns Array of PeopleApiPerson objects
 * @throws Error if API call fails
 */
export async function listAllContacts(
  accessToken: string,
  personFields: string = "names,emailAddresses,organizations,photos"
): Promise<PeopleApiPerson[]> {
  const allContacts: PeopleApiPerson[] = [];
  let nextPageToken: string | undefined = undefined;
  const pageSize = 1000; // Maximum page size for People API

  try {
    do {
      // Build URL with pagination
      let url = `https://people.googleapis.com/v1/people/me/connections?personFields=${encodeURIComponent(personFields)}&pageSize=${pageSize}`;
      if (nextPageToken) {
        url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
      }

      const response = await retryWithBackoff(async () => {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          const error = new Error(`People API listAllContacts failed: ${res.status} ${res.statusText}`);
          (error as Error & { response?: Response }).response = res;
          throw error;
        }

        return res;
      });

      if (!response) {
        throw new Error("Failed to fetch contacts after retries");
      }

      const data: PeopleApiConnectionsListResponse = await response.json();

      // Add contacts from this page
      if (data.connections && data.connections.length > 0) {
        allContacts.push(...data.connections);
      }

      // Check if there are more pages
      nextPageToken = data.nextPageToken;

      // Small delay between pages to avoid rate limits
      if (nextPageToken) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } while (nextPageToken);

    return allContacts;
  } catch (error) {
    // Log error but don't fail completely - return what we have
    reportException(error, {
      context: "Error listing contacts from People API",
      tags: { component: "google-people", endpoint: "people.connections.list" },
      extra: { contactsFetched: allContacts.length },
      level: ErrorLevel.WARNING,
    });

    // If we got some contacts before the error, return them
    if (allContacts.length > 0) {
      return allContacts;
    }

    // Otherwise rethrow
    throw error;
  }
}

