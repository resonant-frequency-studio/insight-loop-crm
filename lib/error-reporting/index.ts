import { ErrorReporter, ErrorLevel, ErrorContext } from "./types";
import { NoopReporter } from "./noop-reporter";
import { ConsoleReporter } from "./console-reporter";
import { SentryReporter } from "./sentry-reporter";

let cachedReporter: ErrorReporter | null = null;
let customReporter: ErrorReporter | null = null;

/**
 * Create an error reporter based on environment configuration
 */
function createReporter(): ErrorReporter {
  // Check for runtime override first
  if (customReporter) {
    return customReporter;
  }

  // Use cached instance if available
  if (cachedReporter) {
    return cachedReporter;
  }

  // Determine provider from environment variable
  const provider = process.env.NEXT_PUBLIC_ERROR_REPORTING_PROVIDER?.toLowerCase() || "console";

  switch (provider) {
    case "sentry":
      cachedReporter = new SentryReporter();
      break;
    case "none":
      cachedReporter = new NoopReporter();
      break;
    case "console":
    default:
      cachedReporter = new ConsoleReporter();
      break;
  }

  return cachedReporter;
}

/**
 * Get the current error reporter instance
 */
export function getErrorReporter(): ErrorReporter {
  return createReporter();
}

/**
 * Register a custom error reporter at runtime
 * This overrides the environment-based provider selection
 * @param reporter - Custom error reporter implementation
 */
export function registerErrorReporter(reporter: ErrorReporter): void {
  customReporter = reporter;
}

/**
 * Clear the custom reporter and revert to environment-based selection
 */
export function clearCustomReporter(): void {
  customReporter = null;
}

/**
 * Convenience function to report an exception
 * @param error - The error to report
 * @param context - Optional context information
 */
export function reportException(error: Error | unknown, context?: ErrorContext): void {
  getErrorReporter().captureException(error, context);
}

/**
 * Convenience function to report a message
 * @param message - The message to report
 * @param level - The severity level (defaults to INFO)
 * @param context - Optional context information
 */
export function reportMessage(
  message: string,
  level?: ErrorLevel,
  context?: ErrorContext
): void {
  getErrorReporter().captureMessage(message, level, context);
}

/**
 * Convenience function to set user context
 * @param user - User identification information
 */
export function setErrorUser(user: { id?: string; email?: string; username?: string } | null): void {
  getErrorReporter().setUser(user);
}

// Export types for use in other modules
export type { ErrorReporter, ErrorContext } from "./types";
export { ErrorLevel } from "./types";

