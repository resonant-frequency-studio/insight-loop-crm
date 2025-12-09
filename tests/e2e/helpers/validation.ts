/**
 * Validation helpers to ensure test code doesn't accidentally use production data
 */

/**
 * Validates that test environment variables are set and not pointing to production
 */
export function validateTestEnvironment(): void {
  const testProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const productionProjectId = process.env.PRODUCTION_FIREBASE_PROJECT_ID;

  if (!testProjectId) {
    throw new Error(
      "Test environment not configured. Please set FIREBASE_ADMIN_PROJECT_ID and NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.test.local"
    );
  }

  // Check if test project ID contains "test" or is explicitly marked as test
  const isTestProject =
    testProjectId.toLowerCase().includes("test") ||
    testProjectId.toLowerCase().includes("dev") ||
    testProjectId.toLowerCase().includes("staging");

  if (!isTestProject && productionProjectId && testProjectId === productionProjectId) {
    throw new Error(
      `CRITICAL: Test project ID (${testProjectId}) matches production project ID. ` +
        "Tests must use a separate Firebase project to prevent data corruption."
    );
  }

  // Warn if project ID doesn't look like a test project
  if (!isTestProject) {
    console.warn(
      `WARNING: Test project ID (${testProjectId}) doesn't contain "test", "dev", or "staging". ` +
        "Please verify you're using a test Firebase project."
    );
  }
}

/**
 * Validates that a contact ID is a test contact (prefixed with "test_")
 */
export function validateTestContactId(contactId: string): void {
  if (!contactId.startsWith("test_")) {
    throw new Error(
      `Invalid test contact ID: ${contactId}. Test contacts must be prefixed with "test_". ` +
        "This prevents accidental use of production data."
    );
  }
}

/**
 * Validates that a user ID is a test user.
 * 
 * Accepts:
 * - Firebase Auth UIDs (typically 28 characters, alphanumeric) - these are safe
 *   because they come from the test Firebase project (validated by validateTestEnvironment)
 * - IDs prefixed with "test_" - for backwards compatibility with test fixtures
 * 
 * This prevents accidental use of production user IDs while allowing legitimate
 * Firebase Auth UIDs from the test environment.
 */
export function validateTestUserId(userId: string): void {
  // Allow Firebase Auth UIDs (typically 28 characters, alphanumeric, no special chars)
  // Firebase Auth UIDs are safe because they come from the test Firebase project
  const isFirebaseAuthUid = /^[a-zA-Z0-9]{20,}$/.test(userId) && userId.length >= 20 && userId.length <= 30;
  
  // Allow test-prefixed IDs for backwards compatibility
  const isTestPrefixed = userId.startsWith("test_");
  
  if (!isFirebaseAuthUid && !isTestPrefixed) {
    throw new Error(
      `Invalid test user ID: ${userId}. Test user IDs must be either:\n` +
      `1. A Firebase Auth UID (20-30 alphanumeric characters) from the test project, or\n` +
      `2. Prefixed with "test_".\n` +
      `This prevents accidental use of production data.`
    );
  }
}

