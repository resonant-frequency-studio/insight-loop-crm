/**
 * Server-safe error utility functions
 * These can be used in both client and server components/API routes
 */

/**
 * Helper function to extract error message from various error types
 * Converts technical errors to customer-friendly messages
 */
export function extractErrorMessage(error: unknown): string {
  let errorMessage = "";
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  } else {
    return "An unexpected error occurred. Please try again.";
  }
  
  // Firestore errors
  if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("Quota exceeded")) {
    return "Database quota exceeded. Please wait a few hours or upgrade your plan.";
  }
  
  if (errorMessage.includes("Update() requires") || errorMessage.includes("not a valid Firestore value")) {
    return "An error occurred while saving data. Please try again.";
  }
  
  if (errorMessage.includes("Cannot use") && errorMessage.includes("as a Firestore value")) {
    return "An error occurred while saving data. Please try again.";
  }
  
  if (errorMessage.includes("requires an index")) {
    return "Database configuration needed. Please contact support.";
  }
  
  // Network errors - but be more specific, don't catch Gmail-specific errors
  if ((errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) && 
      !errorMessage.includes("Gmail") && !errorMessage.includes("reconnect") && !errorMessage.includes("token")) {
    return "Network error. Please check your connection and try again.";
  }
  
  // Only catch generic "network" if it's clearly a network issue, not a Gmail auth issue
  if (errorMessage.toLowerCase().includes("network") && 
      !errorMessage.includes("Gmail") && 
      !errorMessage.includes("reconnect") && 
      !errorMessage.includes("token") &&
      !errorMessage.includes("authentication")) {
    return "Network error. Please check your connection and try again.";
  }
  
  // Gmail API errors - check these FIRST before generic permission errors
  // Preserve specific, user-friendly Gmail error messages
  if (errorMessage.includes("reconnect your Gmail account") ||
      errorMessage.includes("Gmail authentication scopes are insufficient") ||
      errorMessage.includes("Gmail access token has expired") ||
      errorMessage.includes("insufficient authentication scopes") ||
      errorMessage.includes("Gmail authentication scopes")) {
    // These are already user-friendly, preserve them
    return errorMessage;
  }
  
  // Convert generic Gmail API errors to user-friendly messages
  if (errorMessage.includes("Gmail API") || 
      errorMessage.toLowerCase().includes("gmail") ||
      errorMessage.includes("Gmail access token")) {
    return "Email sync error. Please try again or contact support if the issue persists.";
  }
  
  // Permission/authentication errors (but not Gmail-related)
  if (errorMessage.includes("permission") || errorMessage.includes("Permission") || errorMessage.includes("PERMISSION_DENIED")) {
    return "Permission denied. Please ensure you're logged in and have access.";
  }
  
  if (errorMessage.includes("UNAUTHENTICATED") || errorMessage.includes("authentication")) {
    return "Authentication required. Please log in and try again.";
  }
  
  // Generic technical error patterns - convert to friendly messages
  if (errorMessage.includes("TypeError") || errorMessage.includes("ReferenceError") || errorMessage.includes("SyntaxError")) {
    return "An unexpected error occurred. Please refresh the page and try again.";
  }
  
  if (errorMessage.includes("undefined") && errorMessage.includes("is not a function")) {
    return "An error occurred. Please refresh the page and try again.";
  }
  
  // If the error message looks technical (contains common technical terms), provide a generic message
  const technicalPatterns = [
    /\.tsx?:\d+:\d+/i, // File paths with line numbers
    /at \w+\.\w+/, // Stack trace patterns
    /Error: /i,
    /Exception: /i,
    /\[object Object\]/i,
  ];
  
  if (technicalPatterns.some(pattern => pattern.test(errorMessage))) {
    return "An error occurred. Please try again or contact support if the issue persists.";
  }
  
  // If error message is already user-friendly (short, no technical jargon), return it
  if (errorMessage.length < 100 && !errorMessage.includes(".") && !errorMessage.includes("Error")) {
    return errorMessage;
  }
  
  // Default fallback for any remaining technical errors
  return "An error occurred. Please try again or contact support if the issue persists.";
}

/**
 * Convert technical error messages to user-friendly messages
 * This can be used in server-side code (API routes, etc.)
 */
export function toUserFriendlyError(error: unknown): string {
  return extractErrorMessage(error);
}

