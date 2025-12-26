import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";
import { isPlaywrightTest } from "@/util/test-utils";

/**
 * Get the authenticated user ID from the session cookie.
 * In E2E test mode, bypasses the auth check to allow client-side auth handling.
 */
export async function getUserId(): Promise<string> {
  // In E2E test mode, try to get the cookie if it exists, but don't enforce it
  // This allows pages to render and lets client-side auth handle authentication
  const cookieStore = await cookies();
  const cookie = cookieStore.get("__session")?.value;
  
  if (!cookie) {
    if (isPlaywrightTest()) {
      // In E2E mode, throw to allow pages to skip redirect, but components should handle this
      throw new Error("No session cookie found.");
    }
    throw new Error("No session cookie found.");
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(cookie);
    return decoded.uid;
  } catch (error) {
    // In E2E mode, if verification fails, still throw but pages won't redirect
    if (isPlaywrightTest()) {
      throw new Error("No session cookie found.");
    }
    throw error;
  }
}

/**
 * Optionally get user ID - returns null in E2E mode if no valid session.
 * Useful for server components that can work without prefetch in E2E tests.
 */
export async function getUserIdOptional(): Promise<string | null> {
  if (isPlaywrightTest()) {
    try {
      return await getUserId();
    } catch {
      return null;
    }
  }
  return await getUserId();
}

/**
 * Get the authenticated user's email from the session cookie.
 * Returns null if email is unavailable or session is invalid.
 */
export async function getUserEmail(): Promise<string | null> {
  try {
    const userId = await getUserId();
    const userRecord = await adminAuth.getUser(userId);
    return userRecord.email || null;
  } catch (error) {
    // If we can't get the email, return null (graceful degradation)
    return null;
  }
}

