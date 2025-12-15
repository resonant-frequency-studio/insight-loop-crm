"use client";

import React from "react";
import { extractErrorMessage } from "@/lib/error-utils";

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
      className={`flex items-start gap-2 p-3 bg-theme-medium border border-red-200 rounded-sm ${className}`}
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

// Re-export from lib/error-utils for backward compatibility
export { extractErrorMessage, toUserFriendlyError } from "@/lib/error-utils";

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

