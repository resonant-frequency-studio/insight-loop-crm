import { reportMessage, ErrorLevel } from "@/lib/error-reporting";

/**
 * UI Mode Configuration
 * 
 * Reads NEXT_PUBLIC_UI_MODE environment variable to control app-wide UI state
 * for visual regression testing.
 * 
 * Modes:
 * - "suspense": Force all pages to show loading/suspense states
 * - "empty": Force all pages to show empty states (no contacts)
 * - "normal": Use real data (default)
 * 
 * If the variable is missing, commented out, or empty, defaults to "normal"
 */

export type UIMode = "suspense" | "empty" | "normal";

/**
 * Get the current UI mode from environment variable
 * 
 * @returns The UI mode, defaulting to "normal" if not set or invalid
 */
export function getUIMode(): UIMode {
  const envValue = process.env.NEXT_PUBLIC_UI_MODE;
  
  // If undefined, empty string, or whitespace-only, default to "normal"
  if (!envValue || envValue.trim() === "") {
    return "normal";
  }
  
  const normalizedValue = envValue.trim().toLowerCase();
  
  // Validate and return the mode
  if (normalizedValue === "suspense" || normalizedValue === "empty" || normalizedValue === "normal") {
    return normalizedValue as UIMode;
  }
  
  // Invalid value - warn and default to "normal"
  if (typeof window !== "undefined") {
    reportMessage(
      `Invalid NEXT_PUBLIC_UI_MODE value: "${envValue}". Valid values are: "suspense", "empty", "normal". Defaulting to "normal".`,
      ErrorLevel.WARNING,
      {
        context: "UI Mode Configuration",
        tags: { component: "ui-mode" },
      }
    );
  }
  
  return "normal";
}

