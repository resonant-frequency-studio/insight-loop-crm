import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { validateTestEnvironment, validateTestContactId, validateTestUserId } from "./validation";

// Validate test environment on import
validateTestEnvironment();

// Initialize Firebase Admin for tests
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const adminDb = admin.firestore();

// Contact type definition (simplified for tests)
interface Contact {
  contactId: string;
  primaryEmail: string;
  firstName?: string | null;
  lastName?: string | null;
  tags?: string[];
  segment?: string | null;
  leadSource?: string | null;
  notes?: string | null;
  nextTouchpointDate?: unknown | null;
  nextTouchpointMessage?: string | null;
  touchpointStatus?: "pending" | "completed" | "cancelled" | null;
  touchpointStatusUpdatedAt?: unknown | null;
  touchpointStatusReason?: string | null;
  archived?: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

/**
 * Test data factory for creating test contacts
 */
export interface TestContactData {
  primaryEmail: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  segment?: string;
  leadSource?: string;
  notes?: string;
  nextTouchpointDate?: string; // ISO date string
  nextTouchpointMessage?: string;
  touchpointStatus?: "pending" | "completed" | "cancelled" | null;
  archived?: boolean;
}

/**
 * Creates a test contact in Firestore
 * All test contacts are prefixed with "test_" to ensure isolation
 */
export async function createTestContact(
  userId: string,
  data: TestContactData
): Promise<string> {
  // Validate test user ID
  validateTestUserId(userId);
  
  // Normalize email to contactId (same logic as production)
  const contactId = data.primaryEmail.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const testContactId = `test_${contactId}_${Date.now()}`;

  const contact: Omit<Contact, "contactId"> = {
    primaryEmail: data.primaryEmail,
    firstName: data.firstName || null,
    lastName: data.lastName || null,
    tags: data.tags || [],
    segment: data.segment || null,
    leadSource: data.leadSource || null,
    notes: data.notes || null,
    nextTouchpointDate: data.nextTouchpointDate || null,
    nextTouchpointMessage: data.nextTouchpointMessage || null,
    touchpointStatus: data.touchpointStatus || null,
    touchpointStatusUpdatedAt: data.touchpointStatus ? FieldValue.serverTimestamp() : null,
    touchpointStatusReason: null,
    archived: data.archived || false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await adminDb
    .collection("users")
    .doc(userId)
    .collection("contacts")
    .doc(testContactId)
    .set({ ...contact, contactId: testContactId });

  // Small delay to ensure Firestore write is fully propagated
  // Firestore has eventual consistency, so we need to wait a bit
  await new Promise(resolve => setTimeout(resolve, 500));

  // Invalidate Next.js server cache after creating contact
  // This ensures the contact is immediately available when tests navigate to it
  // Without this, Next.js unstable_cache might return stale (empty) results
  // 
  // NOTE: Even with cache bypass in test mode, we still invalidate to be safe
  // and to handle any edge cases where cache might still be used
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
    
    // Call test-only API endpoint to invalidate cache
    // Retry up to 3 times in case the server isn't ready yet
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`${baseUrl}/api/test/revalidate-contact`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            contactId: testContactId,
          }),
          // Add timeout to avoid hanging
          signal: AbortSignal.timeout(5000),
        });
        
        if (response.ok) {
          await response.json(); // Read response but don't need the data
          console.log(`[TEST] Cache invalidated for contact ${testContactId} (attempt ${attempt + 1})`);
          // Wait a bit for cache invalidation to propagate
          await new Promise(resolve => setTimeout(resolve, 200));
          break; // Success, exit retry loop
        } else {
          const errorText = await response.text();
          lastError = new Error(`Cache invalidation failed: ${response.status} ${errorText}`);
          if (attempt < 2) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      } catch (fetchError) {
        lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
        if (attempt < 2) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
    
    if (lastError && process.env.DEBUG_TEST_CACHE) {
      // Only log if explicitly debugging
      console.warn(`[TEST] Cache invalidation had issues (non-fatal):`, lastError.message);
    }
  } catch (error) {
    // Ignore errors - cache invalidation is best effort
    // With cache bypass in test mode, this is less critical
    // If it fails, the test will still work via direct Firestore reads (cache bypass)
    if (process.env.DEBUG_TEST_CACHE) {
      console.warn(`[TEST] Cache invalidation failed (non-fatal):`, error);
    }
  }

  return testContactId;
}

/**
 * Deletes a test contact
 */
export async function deleteTestContact(userId: string, contactId: string): Promise<void> {
  // Validate test IDs
  validateTestUserId(userId);
  validateTestContactId(contactId);
  
  await adminDb
    .collection("users")
    .doc(userId)
    .collection("contacts")
    .doc(contactId)
    .delete();
}

/**
 * Gets a test contact
 */
export async function getTestContact(
  userId: string,
  contactId: string
): Promise<Contact | null> {
  const doc = await adminDb
    .collection("users")
    .doc(userId)
    .collection("contacts")
    .doc(contactId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return { ...doc.data(), contactId: doc.id } as Contact;
}

/**
 * Creates a test contact with touchpoint (pending status)
 */
export async function createTestContactWithTouchpoint(
  userId: string,
  email: string,
  daysFromNow: number = 7
): Promise<string> {
  const touchpointDate = new Date();
  touchpointDate.setDate(touchpointDate.getDate() + daysFromNow);

  return createTestContact(userId, {
    primaryEmail: email,
    firstName: "Test",
    lastName: "Contact",
    nextTouchpointDate: touchpointDate.toISOString().split("T")[0],
    nextTouchpointMessage: "Test touchpoint message",
    touchpointStatus: "pending",
  });
}

/**
 * Creates a test contact with completed touchpoint
 */
export async function createTestContactWithCompletedTouchpoint(
  userId: string,
  email: string
): Promise<string> {
  return createTestContact(userId, {
    primaryEmail: email,
    firstName: "Test",
    lastName: "Contact",
    nextTouchpointDate: new Date().toISOString().split("T")[0],
    nextTouchpointMessage: "Test touchpoint message",
    touchpointStatus: "completed",
  });
}

/**
 * Creates a test contact with cancelled touchpoint
 */
export async function createTestContactWithCancelledTouchpoint(
  userId: string,
  email: string
): Promise<string> {
  return createTestContact(userId, {
    primaryEmail: email,
    firstName: "Test",
    lastName: "Contact",
    nextTouchpointDate: new Date().toISOString().split("T")[0],
    nextTouchpointMessage: "Test touchpoint message",
    touchpointStatus: "cancelled",
  });
}

// ActionItem type definition (simplified for tests)
interface ActionItem {
  actionItemId: string;
  contactId: string;
  userId: string;
  text: string;
  status: "pending" | "completed";
  dueDate?: unknown | null;
  completedAt?: unknown | null;
  createdAt: unknown;
  updatedAt: unknown;
}

/**
 * Test data factory for creating test action items
 */
export interface TestActionItemData {
  text: string;
  status?: "pending" | "completed";
  dueDate?: string; // ISO date string
}

/**
 * Creates a test action item in Firestore
 */
export async function createTestActionItem(
  userId: string,
  contactId: string,
  data: TestActionItemData
): Promise<string> {
  validateTestUserId(userId);
  validateTestContactId(contactId);

  const actionItemId = `test_action_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const actionItem: Omit<ActionItem, "actionItemId"> = {
    contactId,
    userId,
    text: data.text,
    status: data.status || "pending",
    dueDate: data.dueDate || null,
    completedAt: data.status === "completed" ? FieldValue.serverTimestamp() : null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await adminDb
    .collection("users")
    .doc(userId)
    .collection("contacts")
    .doc(contactId)
    .collection("actionItems")
    .doc(actionItemId)
    .set({ ...actionItem, actionItemId });

  return actionItemId;
}

/**
 * Deletes a test action item
 */
export async function deleteTestActionItem(
  userId: string,
  contactId: string,
  actionItemId: string
): Promise<void> {
  validateTestUserId(userId);
  validateTestContactId(contactId);

  await adminDb
    .collection("users")
    .doc(userId)
    .collection("contacts")
    .doc(contactId)
    .collection("actionItems")
    .doc(actionItemId)
    .delete();
}

/**
 * Deletes all action items for a contact (cleanup helper)
 */
export async function deleteAllTestActionItems(
  userId: string,
  contactId: string
): Promise<void> {
  validateTestUserId(userId);
  validateTestContactId(contactId);

  const actionItemsSnapshot = await adminDb
    .collection("users")
    .doc(userId)
    .collection("contacts")
    .doc(contactId)
    .collection("actionItems")
    .get();

  const deletePromises = actionItemsSnapshot.docs.map((doc) => doc.ref.delete());
  await Promise.all(deletePromises);
}

