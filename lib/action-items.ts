import { adminDb } from "@/lib/firebase-admin";
import { ActionItem } from "@/types/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { reportException } from "@/lib/error-reporting";
import { convertTimestamp } from "@/util/timestamp-utils-server";
import { unstable_cache } from "next/cache";
import { isTestMode } from "@/util/test-utils";

/**
 * Get action items path for a contact
 */
export const actionItemsPath = (userId: string, contactId: string) =>
  `users/${userId}/contacts/${contactId}/actionItems`;
export const actionItemDoc = (
  userId: string,
  contactId: string,
  actionItemId: string
) => `users/${userId}/contacts/${contactId}/actionItems/${actionItemId}`;

/**
 * Internal function to fetch action items for a contact (uncached)
 */
async function getActionItemsForContactUncached(
  userId: string,
  contactId: string
): Promise<ActionItem[]> {
  try {
    // Try with orderBy first (requires index)
    const snapshot = await adminDb
      .collection(actionItemsPath(userId, contactId))
      .orderBy("createdAt", "desc")
      .get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data() as ActionItem;
      // Convert Firestore Timestamps to ISO strings for serialization
      return {
        ...data,
        actionItemId: doc.id,
        createdAt: convertTimestamp(data.createdAt) as string,
        updatedAt: convertTimestamp(data.updatedAt) as string,
        completedAt: data.completedAt ? (convertTimestamp(data.completedAt) as string | null) : null,
        dueDate: data.dueDate ? (convertTimestamp(data.dueDate) as string | null) : null,
      };
    });

    return items;
  } catch (error) {
    // If orderBy fails (likely due to missing index), try without orderBy
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("index") || errorMessage.includes("requires an index")) {
      try {
        // Fallback: query without orderBy and sort in memory
        const snapshot = await adminDb
          .collection(actionItemsPath(userId, contactId))
          .get();

        const items = snapshot.docs.map((doc) => {
          const data = doc.data() as ActionItem;
          // Convert Firestore Timestamps to ISO strings for serialization
          return {
            ...data,
            actionItemId: doc.id,
            createdAt: convertTimestamp(data.createdAt) as string,
            updatedAt: convertTimestamp(data.updatedAt) as string,
            completedAt: data.completedAt ? (convertTimestamp(data.completedAt) as string | null) : null,
            dueDate: data.dueDate ? (convertTimestamp(data.dueDate) as string | null) : null,
          };
        });

        // Sort by createdAt in memory (newest first)
        return items.sort((a, b) => {
          const aTime = a.createdAt && typeof a.createdAt === "string"
            ? new Date(a.createdAt).getTime()
            : a.createdAt && typeof a.createdAt === "number"
            ? a.createdAt
            : 0;
          const bTime = b.createdAt && typeof b.createdAt === "string"
            ? new Date(b.createdAt).getTime()
            : b.createdAt && typeof b.createdAt === "number"
            ? b.createdAt
            : 0;
          return bTime - aTime;
        });
    } catch {
      // If fallback also fails, throw the original error
      throw error;
    }
    }
    // For other errors, propagate them
    throw error;
  }
}

/**
 * Get all action items for a contact (cached)
 * 
 * NOTE: This function makes Firestore reads. Use sparingly to avoid quota exhaustion.
 * Consider caching results or using real-time listeners for frequently accessed data.
 */
export async function getActionItemsForContact(
  userId: string,
  contactId: string
): Promise<ActionItem[]> {
  // In test mode, bypass cache to avoid stale data issues
  if (isTestMode()) {
    return getActionItemsForContactUncached(userId, contactId);
  }

  return unstable_cache(
    async () => getActionItemsForContactUncached(userId, contactId),
    [`action-items-${userId}-${contactId}`],
    {
      tags: [`action-items`, `action-items-${userId}`, `action-items-${userId}-${contactId}`],
      revalidate: 300, // 5 minutes
    }
  )();
}

/**
 * Internal function to fetch all action items for a user (uncached)
 */
async function getAllActionItemsForUserUncached(
  userId: string
): Promise<Array<ActionItem & { contactId: string }>> {
  // Get all contacts first
  const contactsSnapshot = await adminDb
    .collection(`users/${userId}/contacts`)
    .get();

  if (contactsSnapshot.empty) {
    return [];
  }

  const contactDocs = contactsSnapshot.docs;
  
  // Process all contacts in parallel (removed batching delays for performance)
  const allPromises = contactDocs.map(async (contactDoc) => {
    const contactId = contactDoc.id;
    try {
      const actionItems = await getActionItemsForContactUncached(userId, contactId);
      // Action items already have timestamps converted to ISO strings
      // Just add contactId
      return actionItems.map((item) => ({
        ...item,
        contactId,
      }));
    } catch (error) {
      reportException(error, {
        context: "Fetching action items for contact",
        tags: { component: "action-items", contactId },
      });
      return []; // Return empty array on error
    }
  });

  const allResults = await Promise.all(allPromises);
  const allActionItems = allResults.flat();

  // Sort by createdAt (newest first)
  return allActionItems.sort((a, b) => {
    const aTime = a.createdAt && typeof a.createdAt === "string"
      ? new Date(a.createdAt).getTime()
      : a.createdAt && typeof a.createdAt === "number"
      ? a.createdAt
      : 0;
    const bTime = b.createdAt && typeof b.createdAt === "string"
      ? new Date(b.createdAt).getTime()
      : b.createdAt && typeof b.createdAt === "number"
      ? b.createdAt
      : 0;
    return bTime - aTime;
  });
}

/**
 * Get all action items for a user (across all contacts) (cached)
 * OPTIMIZED: Uses parallel queries without delays for better performance
 * Returns action items with contactId included and timestamps converted to ISO strings
 */
export async function getAllActionItemsForUser(
  userId: string
): Promise<Array<ActionItem & { contactId: string }>> {
  return unstable_cache(
    async () => getAllActionItemsForUserUncached(userId),
    [`action-items-all-${userId}`],
    {
      tags: [`action-items`, `action-items-${userId}`],
      revalidate: 300, // 5 minutes
    }
  )();
}

/**
 * Get a single action item
 */
export async function getActionItem(
  userId: string,
  contactId: string,
  actionItemId: string
): Promise<ActionItem | null> {
  const doc = await adminDb
    .doc(actionItemDoc(userId, contactId, actionItemId))
    .get();

  if (!doc.exists) return null;

  const data = doc.data() as ActionItem;
  // Convert Firestore Timestamps to ISO strings for serialization
  return {
    ...data,
    actionItemId: doc.id,
    createdAt: convertTimestamp(data.createdAt) as string,
    updatedAt: convertTimestamp(data.updatedAt) as string,
    completedAt: data.completedAt ? (convertTimestamp(data.completedAt) as string | null) : null,
    dueDate: data.dueDate ? (convertTimestamp(data.dueDate) as string | null) : null,
  };
}

/**
 * Create a new action item
 */
export async function createActionItem(
  userId: string,
  contactId: string,
  data: {
    text: string;
    dueDate?: Date | string | null;
  }
): Promise<string> {
  const actionItemId = `action_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  const now = FieldValue.serverTimestamp();
  const actionItem: Omit<ActionItem, "actionItemId"> = {
    contactId,
    userId,
    text: data.text,
    status: "pending",
    dueDate: data.dueDate
      ? typeof data.dueDate === "string"
        ? data.dueDate
        : data.dueDate.toISOString()
      : null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await adminDb
    .doc(actionItemDoc(userId, contactId, actionItemId))
    .set(actionItem);

  return actionItemId;
}

/**
 * Update an action item
 */
export async function updateActionItem(
  userId: string,
  contactId: string,
  actionItemId: string,
  updates: {
    text?: string;
    status?: "pending" | "completed";
    dueDate?: Date | string | null;
  }
): Promise<void> {
  const updateData: Partial<ActionItem> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (updates.text !== undefined) {
    updateData.text = updates.text;
  }

  if (updates.status !== undefined) {
    updateData.status = updates.status;
    if (updates.status === "completed") {
      updateData.completedAt = FieldValue.serverTimestamp();
    } else {
      updateData.completedAt = null;
    }
  }

  if (updates.dueDate !== undefined) {
    updateData.dueDate = updates.dueDate
      ? typeof updates.dueDate === "string"
        ? updates.dueDate
        : updates.dueDate.toISOString()
      : null;
  }

  await adminDb
    .doc(actionItemDoc(userId, contactId, actionItemId))
    .update(updateData);
}

/**
 * Complete an action item
 */
export async function completeActionItem(
  userId: string,
  contactId: string,
  actionItemId: string
): Promise<void> {
  await updateActionItem(userId, contactId, actionItemId, {
    status: "completed",
  });
}

/**
 * Delete an action item
 */
export async function deleteActionItem(
  userId: string,
  contactId: string,
  actionItemId: string
): Promise<void> {
  await adminDb
    .doc(actionItemDoc(userId, contactId, actionItemId))
    .delete();
}

/**
 * Bulk import action items from text (for migration from old actionItems field)
 */
export async function importActionItemsFromText(
  userId: string,
  contactId: string,
  actionItemsText: string
): Promise<string[]> {
  if (!actionItemsText || !actionItemsText.trim()) {
    return [];
  }

  // Split by newlines and filter empty lines
  const items = actionItemsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const createdIds: string[] = [];

  for (const itemText of items) {
    const id = await createActionItem(userId, contactId, {
      text: itemText,
    });
    createdIds.push(id);
  }

  return createdIds;
}

/**
 * Import action items from an array of strings (for Gemini-extracted action items)
 * Skips duplicates by checking existing action items with the same text
 */
export async function importActionItemsFromArray(
  userId: string,
  contactId: string,
  actionItemsArray: string[]
): Promise<string[]> {
  if (!actionItemsArray || actionItemsArray.length === 0) {
    return [];
  }

  // Filter out empty strings
  const validItems = actionItemsArray
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (validItems.length === 0) {
    return [];
  }

  // Get existing action items to avoid duplicates
  const existingActionItems = await getActionItemsForContact(userId, contactId);
  const existingTexts = new Set(
    existingActionItems.map((item) => item.text.trim().toLowerCase())
  );

  const createdIds: string[] = [];

  for (const itemText of validItems) {
    // Skip if duplicate (case-insensitive comparison)
    if (existingTexts.has(itemText.trim().toLowerCase())) {
      continue;
    }

    const id = await createActionItem(userId, contactId, {
      text: itemText,
    });
    createdIds.push(id);
  }

  return createdIds;
}

