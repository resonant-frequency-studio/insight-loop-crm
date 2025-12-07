/**
 * Error reporting abstraction types
 * Provides a pluggable interface for error reporting providers
 */

export enum ErrorLevel {
  DEBUG = "debug",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  FATAL = "fatal",
}

export interface ErrorContext {
  /** Additional context data to attach to the error */
  extra?: Record<string, unknown>;
  /** Tags for categorizing errors */
  tags?: Record<string, string>;
  /** User ID associated with the error */
  userId?: string;
  /** Request/operation context */
  context?: string;
  /** Severity level override */
  level?: ErrorLevel;
}

export interface ErrorReporter {
  /**
   * Capture an exception/error
   * @param error - The error object to capture
   * @param context - Optional context information
   */
  captureException(error: Error | unknown, context?: ErrorContext): void;

  /**
   * Capture a message (non-exception)
   * @param message - The message to capture
   * @param level - The severity level
   * @param context - Optional context information
   */
  captureMessage(
    message: string,
    level?: ErrorLevel,
    context?: ErrorContext
  ): void;

  /**
   * Set user context for subsequent error reports
   * @param user - User identification information
   */
  setUser(user: { id?: string; email?: string; username?: string } | null): void;
}

