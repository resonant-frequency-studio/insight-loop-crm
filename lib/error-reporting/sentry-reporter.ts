import { ErrorReporter, ErrorLevel, ErrorContext } from "./types";

/**
 * Sentry error reporter adapter
 * Wraps Sentry calls in try/catch to prevent crashes if @sentry/nextjs is not installed
 */
export class SentryReporter implements ErrorReporter {
  private getSentry(): typeof import("@sentry/nextjs") | null {
    try {
      // Dynamic import to avoid requiring Sentry at build time
      // This will only work if Sentry is actually installed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("@sentry/nextjs");
    } catch {
      return null;
    }
  }

  private mapLevelToSentrySeverity(level: ErrorLevel): "debug" | "info" | "warning" | "error" | "fatal" {
    switch (level) {
      case ErrorLevel.DEBUG:
        return "debug";
      case ErrorLevel.INFO:
        return "info";
      case ErrorLevel.WARNING:
        return "warning";
      case ErrorLevel.ERROR:
        return "error";
      case ErrorLevel.FATAL:
        return "fatal";
      default:
        return "error";
    }
  }

  captureException(error: Error | unknown, context?: ErrorContext): void {
    try {
      const Sentry = this.getSentry();
      if (!Sentry) {
        // Fallback to console if Sentry is not available
        console.error("Sentry not available. Error:", error, context);
        return;
      }

      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      Sentry.withScope((scope) => {
        if (context?.level) {
          scope.setLevel(this.mapLevelToSentrySeverity(context.level));
        } else {
          scope.setLevel("error");
        }

        if (context?.tags) {
          Object.entries(context.tags).forEach(([key, value]) => {
            scope.setTag(key, value);
          });
        }

        if (context?.extra) {
          Object.entries(context.extra).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }

        if (context?.userId) {
          scope.setUser({ id: context.userId });
        }

        if (context?.context) {
          scope.setContext("custom", { context: context.context });
        }

        Sentry.captureException(errorObj);
      });
    } catch (err) {
      // Fail silently - don't crash the app if Sentry fails
      console.error("Failed to report error to Sentry:", err);
    }
  }

  captureMessage(
    message: string,
    level: ErrorLevel = ErrorLevel.INFO,
    context?: ErrorContext
  ): void {
    try {
      const Sentry = this.getSentry();
      if (!Sentry) {
        // Fallback to console if Sentry is not available
        console.log(`[${level}] ${message}`, context);
        return;
      }

      Sentry.withScope((scope) => {
        scope.setLevel(this.mapLevelToSentrySeverity(level));

        if (context?.tags) {
          Object.entries(context.tags).forEach(([key, value]) => {
            scope.setTag(key, value);
          });
        }

        if (context?.extra) {
          Object.entries(context.extra).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }

        if (context?.userId) {
          scope.setUser({ id: context.userId });
        }

        if (context?.context) {
          scope.setContext("custom", { context: context.context });
        }

        Sentry.captureMessage(message, this.mapLevelToSentrySeverity(level));
      });
    } catch (err) {
      // Fail silently - don't crash the app if Sentry fails
      console.error("Failed to report message to Sentry:", err);
    }
  }

  setUser(user: { id?: string; email?: string; username?: string } | null): void {
    try {
      const Sentry = this.getSentry();
      if (!Sentry) {
        return;
      }

      if (user) {
        Sentry.setUser({
          id: user.id,
          email: user.email,
          username: user.username,
        });
      } else {
        Sentry.setUser(null);
      }
    } catch (err) {
      // Fail silently - don't crash the app if Sentry fails
      console.error("Failed to set Sentry user:", err);
    }
  }
}

