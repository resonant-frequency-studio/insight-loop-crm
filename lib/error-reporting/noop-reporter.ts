import { ErrorReporter, ErrorLevel, ErrorContext } from "./types";

/**
 * No-op error reporter that does nothing
 * Useful for disabling error reporting or in test environments
 */
export class NoopReporter implements ErrorReporter {
  captureException(_error: Error | unknown, _context?: ErrorContext): void {
    // No-op
  }

  captureMessage(
    _message: string,
    _level?: ErrorLevel,
    _context?: ErrorContext
  ): void {
    // No-op
  }

  setUser(_user: { id?: string; email?: string; username?: string } | null): void {
    // No-op
  }
}

