"use client";

import React from "react";

export interface ErrorMessageProps {
  message: string;
  className?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function ErrorMessage({
  message,
  className = "",
  dismissible = false,
  onDismiss,
}: ErrorMessageProps) {
  const [dismissed, setDismissed] = React.useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  return (
    <div
      className={`flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg ${className}`}
      role="alert"
      aria-live="polite"
    >
      <svg
        className="w-5 h-5 text-red-600 shrink-0 mt-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p className="flex-1 text-sm text-red-800 font-medium">{message}</p>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
          aria-label="Dismiss error message"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

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
  
  // Network errors
  if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError") || errorMessage.includes("network")) {
    return "Network error. Please check your connection and try again.";
  }
  
  // Permission/authentication errors
  if (errorMessage.includes("permission") || errorMessage.includes("Permission") || errorMessage.includes("PERMISSION_DENIED")) {
    return "Permission denied. Please ensure you're logged in and have access.";
  }
  
  if (errorMessage.includes("UNAUTHENTICATED") || errorMessage.includes("authentication")) {
    return "Authentication required. Please log in and try again.";
  }
  
  // Gmail API errors
  if (errorMessage.includes("Gmail API") || errorMessage.includes("gmail")) {
    return "Email sync error. Please try again or contact support if the issue persists.";
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
 * Helper function to extract error from API response
 */
export async function extractApiError(response: Response): Promise<string> {
  try {
    const errorData = await response.json();
    if (errorData.error) {
      return extractErrorMessage(errorData.error);
    }
    if (errorData.message) {
      return extractErrorMessage(errorData.message);
    }
  } catch {
    // If JSON parsing fails, use status text
  }
  
  // Use status text as fallback
  if (response.status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (response.status === 503) {
    return "Service temporarily unavailable. Please try again later.";
  }
  if (response.status >= 500) {
    return "Server error. Please try again later.";
  }
  if (response.status === 401 || response.status === 403) {
    return "Authentication required. Please log in and try again.";
  }
  
  return extractErrorMessage(`Request failed: ${response.statusText || "Unknown error"}`);
}

/**
 * Convert technical error messages to user-friendly messages
 * This can be used in server-side code (API routes, etc.)
 */
export function toUserFriendlyError(error: unknown): string {
  return extractErrorMessage(error);
}


