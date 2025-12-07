# Error Reporting System

The Insight Loop CRM includes a pluggable error reporting system that allows you to switch between different error reporting providers or disable error reporting entirely. This system is designed to be white-label safe and environment-driven.

## Overview

The error reporting system provides a unified interface for capturing exceptions and messages across the application. It supports multiple providers:

- **Console** (default): Logs errors to the browser/Node console
- **Sentry**: Sends errors to Sentry for monitoring and alerting
- **None**: Disables error reporting (no-op)

## Configuration

### Environment Variables

Configure the error reporting provider using environment variables:

```bash
# Error Reporting Configuration
# Options: "console" (default), "sentry", "none"
NEXT_PUBLIC_ERROR_REPORTING_PROVIDER=console

# Sentry DSN (required if using "sentry" provider)
SENTRY_DSN=your_sentry_dsn_here
```

### Provider Options

#### Console Provider (Default)

The console provider logs all errors and messages to the browser/Node console. This is the default behavior and requires no additional setup.

```bash
NEXT_PUBLIC_ERROR_REPORTING_PROVIDER=console
```

#### Sentry Provider

To use Sentry for error monitoring:

1. **Install Sentry** (if not already installed):
   ```bash
   npm install @sentry/nextjs
   ```

2. **Get your Sentry DSN**:
   - Go to [Sentry Dashboard](https://sentry.io)
   - Navigate to Settings > Projects > Your Project
   - Copy the DSN from Client Keys (DSN)

3. **Configure environment variables**:
   ```bash
   NEXT_PUBLIC_ERROR_REPORTING_PROVIDER=sentry
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   ```

4. **Initialize Sentry** (if needed):
   The SentryReporter adapter will automatically use Sentry if it's installed. However, you may want to initialize Sentry in your Next.js app for additional features. See [Sentry Next.js documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/) for full setup instructions.

**Note**: The SentryReporter is designed to fail gracefully if Sentry is not installed, so your app won't crash if you forget to install it.

#### Disable Error Reporting

To completely disable error reporting:

```bash
NEXT_PUBLIC_ERROR_REPORTING_PROVIDER=none
```

This uses a no-op reporter that silently ignores all errors and messages.

## Usage

### Basic Usage

Import the convenience functions from the error reporting module:

```typescript
import { reportException, reportMessage, setErrorUser } from "@/lib/error-reporting";

// Report an exception
try {
  // ... some code
} catch (error) {
  reportException(error, {
    context: "User action failed",
    userId: user.id,
    extra: { action: "saveContact" }
  });
}

// Report a message
reportMessage("Something important happened", ErrorLevel.WARNING, {
  tags: { component: "ContactEditor" }
});

// Set user context (applies to all subsequent reports)
setErrorUser({ id: user.id, email: user.email });
```

### Error Levels

The system supports the following error levels:

- `ErrorLevel.DEBUG`: Debug information
- `ErrorLevel.INFO`: Informational messages
- `ErrorLevel.WARNING`: Warning messages
- `ErrorLevel.ERROR`: Error messages
- `ErrorLevel.FATAL`: Fatal errors

### Error Context

You can provide additional context when reporting errors:

```typescript
reportException(error, {
  // Additional data
  extra: {
    contactId: "123",
    action: "update",
    timestamp: Date.now()
  },
  // Tags for categorization
  tags: {
    component: "ContactEditor",
    feature: "contacts"
  },
  // User ID
  userId: user.id,
  // Operation context
  context: "Updating contact information",
  // Override severity level
  level: ErrorLevel.ERROR
});
```

## Custom Provider Implementation

You can implement a custom error reporter by implementing the `ErrorReporter` interface:

```typescript
import { ErrorReporter, ErrorLevel, ErrorContext } from "@/lib/error-reporting/types";

class CustomReporter implements ErrorReporter {
  captureException(error: Error | unknown, context?: ErrorContext): void {
    // Your custom error handling logic
  }

  captureMessage(
    message: string,
    level?: ErrorLevel,
    context?: ErrorContext
  ): void {
    // Your custom message handling logic
  }

  setUser(user: { id?: string; email?: string; username?: string } | null): void {
    // Your custom user context handling
  }
}
```

### Registering a Custom Provider

You can register a custom reporter at runtime:

```typescript
import { registerErrorReporter } from "@/lib/error-reporting";
import { CustomReporter } from "./custom-reporter";

// Register your custom reporter
registerErrorReporter(new CustomReporter());

// All subsequent error reports will use your custom reporter
```

To revert to the environment-based provider:

```typescript
import { clearCustomReporter } from "@/lib/error-reporting";

clearCustomReporter();
```

## Migration Guide

### Replacing console.error

**Before:**
```typescript
try {
  // ... code
} catch (error) {
  console.error("Error:", error);
}
```

**After:**
```typescript
import { reportException } from "@/lib/error-reporting";

try {
  // ... code
} catch (error) {
  reportException(error, { context: "Operation description" });
}
```

### Replacing console.warn

**Before:**
```typescript
console.warn("Warning: Something happened");
```

**After:**
```typescript
import { reportMessage, ErrorLevel } from "@/lib/error-reporting";

reportMessage("Warning: Something happened", ErrorLevel.WARNING);
```

### Replacing throw statements

**Before:**
```typescript
if (!userId) {
  throw new Error("User ID is required");
}
```

**After:**
```typescript
import { reportException } from "@/lib/error-reporting";

if (!userId) {
  const error = new Error("User ID is required");
  reportException(error, { context: "Validation failed" });
  throw error; // Still throw if needed for control flow
}
```

## Best Practices

1. **Always provide context**: Include relevant context information when reporting errors to help with debugging.

2. **Use appropriate error levels**: Choose the right level for your message (DEBUG, INFO, WARNING, ERROR, FATAL).

3. **Set user context early**: Call `setErrorUser()` when a user logs in so all subsequent errors are associated with that user.

4. **Don't report expected errors**: Only report unexpected errors. Validation errors and expected business logic failures don't need to be reported.

5. **Include relevant tags**: Use tags to categorize errors for easier filtering and analysis.

## Architecture

The error reporting system is built with the following components:

- **Types** (`lib/error-reporting/types.ts`): Core interfaces and types
- **NoopReporter** (`lib/error-reporting/noop-reporter.ts`): No-op implementation
- **ConsoleReporter** (`lib/error-reporting/console-reporter.ts`): Console-based logging
- **SentryReporter** (`lib/error-reporting/sentry-reporter.ts`): Sentry integration adapter
- **Factory** (`lib/error-reporting/index.ts`): Provider factory and convenience functions

The system uses a singleton pattern with lazy initialization, ensuring only one reporter instance is created per application lifecycle.

