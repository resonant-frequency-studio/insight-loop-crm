import { reportException } from "@/lib/error-reporting";

export interface RetryableError {
  retryable: boolean;
  retryAfter?: number; // seconds
  error: Error;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorMessage = error.message.toLowerCase();
  const statusCode = (error as Error & { statusCode?: number }).statusCode;

  // Network errors are retryable
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("econnreset") ||
    errorMessage.includes("enotfound")
  ) {
    return true;
  }

  // Rate limiting is retryable
  if (statusCode === 429 || errorMessage.includes("rate limit")) {
    return true;
  }

  // 5xx server errors are retryable
  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return true;
  }

  // Auth errors are NOT retryable (need re-auth)
  if (statusCode === 401 || statusCode === 403 || errorMessage.includes("auth")) {
    return false;
  }

  // 4xx client errors (except auth) are NOT retryable
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return false;
  }

  return false;
}

/**
 * Get retry delay with exponential backoff
 */
export function getRetryDelay(attempt: number, baseDelaySeconds: number = 1): number {
  return Math.min(baseDelaySeconds * Math.pow(2, attempt), 300); // Max 5 minutes
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelaySeconds: number = 1
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryableError(lastError)) {
        throw lastError;
      }

      if (attempt < maxAttempts - 1) {
        const delay = getRetryDelay(attempt, baseDelaySeconds);
        await new Promise((resolve) => setTimeout(resolve, delay * 1000));
      }
    }
  }

  throw lastError || new Error("Retry failed");
}

/**
 * Handle sync errors and determine if they should be retried
 */
export function handleSyncError(
  error: unknown,
  context: string,
  tags: Record<string, string> = {}
): RetryableError {
  const err = error instanceof Error ? error : new Error(String(error));
  const retryable = isRetryableError(err);

  reportException(err, {
    context,
    tags: { component: "sync-error-handler", ...tags },
  });

  let retryAfter: number | undefined;
  if (retryable) {
    const statusCode = (err as Error & { statusCode?: number }).statusCode;
    if (statusCode === 429) {
      // Rate limiting - retry after 60 seconds
      retryAfter = 60;
    } else {
      // Other retryable errors - use exponential backoff
      retryAfter = 1;
    }
  }

  return {
    retryable,
    retryAfter,
    error: err,
  };
}

