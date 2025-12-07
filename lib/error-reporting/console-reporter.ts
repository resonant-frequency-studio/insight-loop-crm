import { ErrorReporter, ErrorLevel, ErrorContext } from "./types";

/**
 * Console-based error reporter
 * Logs errors and messages to the browser/Node console
 */
export class ConsoleReporter implements ErrorReporter {
  captureException(error: Error | unknown, context?: ErrorContext): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    console.error("Error captured:", errorObj.message, {
      error: errorObj,
      stack: errorObj.stack,
      ...context,
    });
  }

  captureMessage(
    message: string,
    level: ErrorLevel = ErrorLevel.INFO,
    context?: ErrorContext
  ): void {
    const logData = { message, level, ...context };

    switch (level) {
      case ErrorLevel.DEBUG:
        console.debug("Debug:", message, logData);
        break;
      case ErrorLevel.INFO:
        console.info("Info:", message, logData);
        break;
      case ErrorLevel.WARNING:
        console.warn("Warning:", message, logData);
        break;
      case ErrorLevel.ERROR:
      case ErrorLevel.FATAL:
        console.error("Error:", message, logData);
        break;
      default:
        console.log("Log:", message, logData);
    }
  }

  setUser(user: { id?: string; email?: string; username?: string } | null): void {
    if (user) {
      console.info("Error reporter user context set:", {
        id: user.id,
        email: user.email,
        username: user.username,
      });
    } else {
      console.info("Error reporter user context cleared");
    }
  }
}

