import { test as base, expect, Page } from "@playwright/test";
import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// Load test environment variables from .env.test.local
const envPath = path.join(process.cwd(), ".env.test.local");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf-8");
  envFile.split("\n").forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Only set if not already set (don't override existing env vars)
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Initialize Firebase Admin for tests (using test environment variables)
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Please ensure .env.test.local contains:\n" +
      "FIREBASE_ADMIN_PROJECT_ID\n" +
      "FIREBASE_ADMIN_CLIENT_EMAIL\n" +
      "FIREBASE_ADMIN_PRIVATE_KEY"
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const adminAuth = admin.auth();
const adminDb = admin.firestore();

/**
 * Test user fixture for authenticated sessions
 * Creates a test user in Firebase Auth and provides authentication
 */
export const test = base.extend<{
  authenticatedPage: Page;
  testUserId: string;
}>({
  testUserId: async ({}, use: (value: string) => Promise<void>) => {
    // Generate a unique test user ID
    const testUserId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create test user in Firebase Auth
    const testEmail = `test_${testUserId}@test.example.com`;
    let firebaseUserId: string;
    
    try {
      const user = await adminAuth.createUser({
        email: testEmail,
        emailVerified: true,
        displayName: `Test User ${testUserId}`,
      });
      firebaseUserId = user.uid;
    } catch (error) {
      // User might already exist, try to get it
      const existingUser = await adminAuth.getUserByEmail(testEmail).catch(() => null);
      if (existingUser) {
        firebaseUserId = existingUser.uid;
      } else {
        throw error;
      }
    }
    
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(firebaseUserId);
    
    // Cleanup: Delete test user and all their data
    try {
      // Delete all contacts for this user
      const contactsSnapshot = await adminDb
        .collection("users")
        .doc(firebaseUserId)
        .collection("contacts")
        .get();
      
      const deletePromises = contactsSnapshot.docs.map((doc) => doc.ref.delete());
      await Promise.all(deletePromises);
      
      // Delete all action items
      const actionItemsSnapshot = await adminDb
        .collection("users")
        .doc(firebaseUserId)
        .collection("actionItems")
        .get();
      
      const actionItemsDeletePromises = actionItemsSnapshot.docs.map((doc) => doc.ref.delete());
      await Promise.all(actionItemsDeletePromises);
      
      // Delete the user
      await adminAuth.deleteUser(firebaseUserId);
    } catch (error) {
      console.error(`Failed to cleanup test user ${firebaseUserId}:`, error);
      // Don't throw - cleanup failures shouldn't fail tests
    }
  },

  authenticatedPage: async (
    { page, testUserId }: { page: Page; testUserId: string },
    use: (page: Page) => Promise<void>
  ) => {
    // Step 1: Navigate to login page and authenticate in browser context
    // This ensures the cookie is set in the same context that will be used for subsequent navigation
    await page.goto("/login");
    
    await page.evaluate(async (userId: string) => {
      const response = await fetch("/api/test/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (errorData as any).error || "Authentication failed"
        );
      }
      
      // Verify session
      const verifyResponse = await fetch("/api/auth/check", {
        credentials: "include",
      });
      
      if (!verifyResponse.ok) {
        throw new Error("Session verification failed");
      }
    }, testUserId);
    
    // Step 2: Verify cookie is present
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "__session");
    if (!sessionCookie) {
      throw new Error("Session cookie not found after authentication");
    }
    
    // Step 3: Navigate to the app
    // With E2E_TEST_MODE enabled, SSR won't redirect to login
    // Client-side auth will handle authentication once the page loads
    await page.goto("/", { waitUntil: "networkidle" });
    
    // Step 4: Wait for client-side auth check and any redirects
    // In E2E mode, the session cookie check should prevent redirect
    await page.waitForTimeout(2000);
    
    // Step 5: Check if we were redirected to login
    let currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      // Wait a bit more - the session check might still be in progress
      await page.waitForTimeout(1000);
      currentUrl = page.url();
      
      const cookies = await page.context().cookies();
      const hasSession = cookies.some((c) => c.name === "__session");
      
      if (!hasSession) {
        throw new Error("Session cookie was lost - authentication failed");
      }
      
      console.warn(
        `Still on /login after authentication. ` +
        `Has session cookie: ${hasSession}. ` +
        `Client-side auth check might be failing.`
      );
    }
    
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

export { expect };

