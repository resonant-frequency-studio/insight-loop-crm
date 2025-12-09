import { adminDb } from "@/lib/firebase-admin";
import { Contact } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";
import { convertTimestamp } from "@/util/timestamp-utils-server";
import { unstable_cache } from "next/cache";
import { isTestMode } from "@/util/test-utils";

/**
 * Get contacts path for a user
 */
const contactsPath = (userId: string) => `users/${userId}/contacts`;

/**
 * Convert a Contact document to have ISO string timestamps
 */
function convertContactTimestamps(contact: Contact): Contact {
  return {
    ...contact,
    createdAt: convertTimestamp(contact.createdAt),
    updatedAt: convertTimestamp(contact.updatedAt),
    lastEmailDate: contact.lastEmailDate ? convertTimestamp(contact.lastEmailDate) : null,
    nextTouchpointDate: contact.nextTouchpointDate ? convertTimestamp(contact.nextTouchpointDate) : null,
    touchpointStatusUpdatedAt: contact.touchpointStatusUpdatedAt
      ? convertTimestamp(contact.touchpointStatusUpdatedAt)
      : null,
    summaryUpdatedAt: contact.summaryUpdatedAt ? convertTimestamp(contact.summaryUpdatedAt) : null,
  };
}

/**
 * Internal function to fetch a single contact (uncached)
 */
async function getContactForUserUncached(
  userId: string,
  contactId: string
): Promise<Contact | null> {
  try {
    const doc = await adminDb
      .collection(contactsPath(userId))
      .doc(contactId)
      .get();

    if (!doc.exists) {
      // In test mode, add debug logging
      if (isTestMode()) {
        if (process.env.DEBUG_TEST_CACHE) {
          console.log(`[TEST] Contact not found: userId=${userId}, contactId=${contactId}`);
          // List available contacts for debugging
          const snapshot = await adminDb.collection(contactsPath(userId)).get();
          const availableIds = snapshot.docs.map(d => d.id).slice(0, 5);
          console.log(`[TEST] Available contact IDs (first 5):`, availableIds);
        }
      }
      return null;
    }

    const data = doc.data() as Contact;
    return convertContactTimestamps(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for quota errors
    if (
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("Quota exceeded")
    ) {
      reportException(error, {
        context: "Getting contact (quota exceeded)",
        tags: { component: "contacts-server", userId, contactId },
      });
      throw new Error("Database quota exceeded. Please wait a few hours or upgrade your plan.");
    }

    reportException(error, {
      context: "Getting contact",
      tags: { component: "contacts-server", userId, contactId },
    });
    throw error;
  }
}

/**
 * Get a single contact for a user (cached)
 * 
 * @param userId - The user ID
 * @param contactId - The contact ID
 * @returns The contact data or null if not found
 */
export async function getContactForUser(
  userId: string,
  contactId: string
): Promise<Contact | null> {
  // In test mode, bypass cache to avoid stale data issues
  // Tests create contacts and immediately navigate to them, so cache can be problematic
  
  if (isTestMode()) {
    // Add debug logging in test mode
    if (process.env.DEBUG_TEST_CACHE) {
      console.log(`[TEST] getContactForUser: bypassing cache for userId=${userId}, contactId=${contactId}`);
    }
    return getContactForUserUncached(userId, contactId);
  }

  return unstable_cache(
    async () => getContactForUserUncached(userId, contactId),
    [`contact-${userId}-${contactId}`],
    {
      tags: [`contacts`, `contacts-${userId}`, `contact-${userId}-${contactId}`],
      revalidate: 300, // 5 minutes
    }
  )();
}

/**
 * Internal function to fetch all contacts (uncached)
 */
async function getAllContactsForUserUncached(
  userId: string
): Promise<Contact[]> {
  try {
    const snapshot = await adminDb.collection(contactsPath(userId)).get();

    if (snapshot.empty) {
      return [];
    }

    const contacts = snapshot.docs.map((doc) => {
      const data = doc.data() as Contact;
      return convertContactTimestamps(data);
    });

    return contacts;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for quota errors
    if (
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("Quota exceeded")
    ) {
      reportException(error, {
        context: "Getting all contacts (quota exceeded)",
        tags: { component: "contacts-server", userId },
      });
      throw new Error("Database quota exceeded. Please wait a few hours or upgrade your plan.");
    }

    reportException(error, {
      context: "Getting all contacts",
      tags: { component: "contacts-server", userId },
    });
    throw error;
  }
}

/**
 * Get all contacts for a user (cached)
 * 
 * @param userId - The user ID
 * @returns Array of contacts with timestamps converted to ISO strings
 */
export async function getAllContactsForUser(
  userId: string
): Promise<Contact[]> {
  // In test mode, bypass cache to avoid stale data issues
  if (isTestMode()) {
    return getAllContactsForUserUncached(userId);
  }

  return unstable_cache(
    async () => getAllContactsForUserUncached(userId),
    [`contacts-${userId}`],
    {
      tags: [`contacts`, `contacts-${userId}`],
      revalidate: 300, // 5 minutes
    }
  )();
}

/**
 * Get all contacts for a user as a Map keyed by contactId
 * 
 * @param userId - The user ID
 * @returns Map of contactId to Contact with timestamps converted to ISO strings
 */
export async function getContactsMapForUser(
  userId: string
): Promise<Map<string, Contact>> {
  try {
    const contacts = await getAllContactsForUser(userId);
    const contactsMap = new Map<string, Contact>();

    contacts.forEach((contact) => {
      contactsMap.set(contact.contactId, contact);
    });

    return contactsMap;
  } catch (error) {
    // Error already handled in getAllContactsForUser
    throw error;
  }
}

/**
 * Internal function to fetch unique segments (uncached)
 */
async function getUniqueSegmentsForUserUncached(
  userId: string
): Promise<string[]> {
  try {
    const snapshot = await adminDb.collection(contactsPath(userId)).get();

    if (snapshot.empty) {
      return [];
    }

    const segments = new Set<string>();
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Contact;
      if (data.segment && typeof data.segment === "string") {
        segments.add(data.segment);
      }
    });

    return Array.from(segments).sort();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for quota errors
    if (
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("Quota exceeded")
    ) {
      reportException(error, {
        context: "Getting unique segments (quota exceeded)",
        tags: { component: "contacts-server", userId },
      });
      throw new Error("Database quota exceeded. Please wait a few hours or upgrade your plan.");
    }

    reportException(error, {
      context: "Getting unique segments",
      tags: { component: "contacts-server", userId },
    });
    throw error;
  }
}

/**
 * Get unique segments for a user (cached)
 * 
 * @param userId - The user ID
 * @returns Array of unique segment strings, sorted alphabetically
 */
export async function getUniqueSegmentsForUser(
  userId: string
): Promise<string[]> {
  return unstable_cache(
    async () => getUniqueSegmentsForUserUncached(userId),
    [`segments-${userId}`],
    {
      tags: [`contacts`, `contacts-${userId}`],
      revalidate: 300, // 5 minutes
    }
  )();
}

