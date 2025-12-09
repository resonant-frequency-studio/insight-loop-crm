/**
 * Utility functions for detecting test environments
 */

/**
 * Checks if the code is running in a test environment (Jest or Playwright/E2E)
 * 
 * @returns true if running in test mode (either E2E_TEST_MODE=true or NODE_ENV=test)
 */
export function isTestMode(): boolean {
  return process.env.E2E_TEST_MODE === "true" || process.env.NODE_ENV === "test";
}

/**
 * Checks if the code is running in Playwright/E2E test mode
 * 
 * @returns true if E2E_TEST_MODE is set to "true"
 */
export function isPlaywrightTest(): boolean {
  return process.env.E2E_TEST_MODE === "true";
}

/**
 * Checks if the code is running in Jest test mode
 * 
 * @returns true if NODE_ENV is set to "test"
 */
export function isJestTest(): boolean {
  return process.env.NODE_ENV === "test";
}

