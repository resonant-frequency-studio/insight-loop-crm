import { adminDb } from "@/lib/firebase-admin";
import { ActionItem, Contact } from "@/types/firestore";
import { FieldValue, FieldPath } from "firebase-admin/firestore";
import { reportException } from "@/lib/error-reporting";
import { convertTimestamp } from "@/util/timestamp-utils-server";

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
 * Get all action items for a contact
 * 
 * NOTE: This function makes Firestore reads. Use sparingly to avoid quota exhaustion.
 * Cache removed to ensure React Query works properly with real-time updates.
 */
export async function getActionItemsForContact(
  userId: string,
  contactId: string
): Promise<ActionItem[]> {
  return getActionItemsForContactUncached(userId, contactId);
}

/**
 * Internal function to fetch all action items for a user (uncached)
 * OPTIMIZED: Uses collection group query to fetch all action items in ONE query instead of N queries
 * Enriches action items with contact fields (firstName, lastName, primaryEmail) for better performance
 */
async function getAllActionItemsForUserUncached(
  userId: string
): Promise<Array<ActionItem & { 
  contactId: string;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactEmail?: string;
}>> {
  try {
    // Use collection group query to fetch all actionItems across all contacts in ONE query
    // This requires a composite index: collectionGroup('actionItems'), fields: userId (asc), createdAt (desc)
    const actionItemsSnapshot = await adminDb
      .collectionGroup("actionItems")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    if (actionItemsSnapshot.empty) {
      return [];
    }

    // Extract contactIds from document paths
    // Path format: users/{userId}/contacts/{contactId}/actionItems/{actionItemId}
    const contactIds = new Set<string>();
    const actionItemsMap = new Map<string, Array<ActionItem & { contactId: string }>>();
    
    actionItemsSnapshot.docs.forEach((doc) => {
      const pathParts = doc.ref.path.split("/");
      const contactId = pathParts[3]; // Extract contactId from path
      contactIds.add(contactId);
      
      if (!actionItemsMap.has(contactId)) {
        actionItemsMap.set(contactId, []);
      }
      
      const data = doc.data() as ActionItem;
      actionItemsMap.get(contactId)!.push({
        ...data,
        actionItemId: doc.id,
        contactId,
        createdAt: convertTimestamp(data.createdAt) as string,
        updatedAt: convertTimestamp(data.updatedAt) as string,
        completedAt: data.completedAt ? (convertTimestamp(data.completedAt) as string | null) : null,
        dueDate: data.dueDate ? (convertTimestamp(data.dueDate) as string | null) : null,
      });
    });

    // Fetch only contacts that have action items (much smaller set than all contacts)
    // Use 'in' query with up to 10 contactIds at a time (Firestore limit)
    const contactIdsArray = Array.from(contactIds);
    const contactsMap = new Map<string, Contact>();
    
    // Firestore 'in' queries are limited to 10 items, so batch if needed
    const batchSize = 10;
    for (let i = 0; i < contactIdsArray.length; i += batchSize) {
      const batch = contactIdsArray.slice(i, i + batchSize);
      const contactsSnapshot = await adminDb
        .collection(`users/${userId}/contacts`)
        .where(FieldPath.documentId(), "in", batch)
        .get();

      contactsSnapshot.docs.forEach((doc) => {
        contactsMap.set(doc.id, { ...doc.data(), contactId: doc.id } as Contact);
      });
    }

    // Enrich and flatten action items with contact fields
    const allActionItems: Array<ActionItem & { 
      contactId: string;
      contactFirstName?: string | null;
      contactLastName?: string | null;
      contactEmail?: string;
    }> = [];

    actionItemsMap.forEach((items, contactId) => {
      const contact = contactsMap.get(contactId);
      items.forEach((item) => {
        allActionItems.push({
          ...item,
          contactId,
          contactFirstName: contact?.firstName || null,
          contactLastName: contact?.lastName || null,
          contactEmail: contact?.primaryEmail || undefined,
        });
      });
    });

    // Already sorted by createdAt desc from query, but ensure consistency
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // If collection group query fails (likely due to missing index), fall back to old method
    if (
      errorMessage.includes("index") || 
      errorMessage.includes("requires an index") ||
      errorMessage.includes("FAILED_PRECONDITION") ||
      (error instanceof Error && error.message.includes("index"))
    ) {
      reportException(error, {
        context: "Collection group query failed, falling back to per-contact queries",
        tags: { component: "action-items", userId },
        extra: { 
          error: errorMessage,
          note: "This is expected if the Firestore index hasn't been created yet. The page will work but may be slower."
        },
      });
      
      // Fallback to old method (N+1 queries)
      return getAllActionItemsForUserFallback(userId);
    }
    
    // For other errors, propagate them
    throw error;
  }
}

/**
 * Fallback method: Fetch action items using per-contact queries (N+1 pattern)
 * Used when collection group query is not available (missing index)
 */
async function getAllActionItemsForUserFallback(
  userId: string
): Promise<Array<ActionItem & { 
  contactId: string;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactEmail?: string;
}>> {
  // Get all contacts first
  const contactsSnapshot = await adminDb
    .collection(`users/${userId}/contacts`)
    .get();

  if (contactsSnapshot.empty) {
    return [];
  }

  const contactDocs = contactsSnapshot.docs;
  
  // Create a map of contactId -> contact data for efficient lookup
  const contactsMap = new Map<string, Contact>();
  contactDocs.forEach((contactDoc) => {
    const contact = { ...contactDoc.data(), contactId: contactDoc.id } as Contact;
    contactsMap.set(contactDoc.id, contact);
  });
  
  // Process all contacts in parallel (removed batching delays for performance)
  const allPromises = contactDocs.map(async (contactDoc) => {
    const contactId = contactDoc.id;
    const contact = contactsMap.get(contactId);
    try {
      const actionItems = await getActionItemsForContactUncached(userId, contactId);
      // Action items already have timestamps converted to ISO strings
      // Enrich with contact fields
      return actionItems.map((item) => ({
        ...item,
        contactId,
        contactFirstName: contact?.firstName || null,
        contactLastName: contact?.lastName || null,
        contactEmail: contact?.primaryEmail || undefined,
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
 * Get all action items for a user (across all contacts)
 * OPTIMIZED: Uses collection group query to fetch all action items in ONE query instead of N+1 queries
 * This reduces Firestore reads from (1 + N) to (1 + ceil(N/10)) where N = number of contacts with action items
 * Returns action items enriched with contact fields (firstName, lastName, primaryEmail)
 * and timestamps converted to ISO strings
 * Cache removed to ensure React Query works properly with real-time updates.
 * 
 * Requires Firestore composite index: collectionGroup('actionItems'), fields: userId (asc), createdAt (desc)
 * Falls back to per-contact queries if index is not available.
 */
export async function getAllActionItemsForUser(
  userId: string
): Promise<Array<ActionItem & { 
  contactId: string;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactEmail?: string;
}>> {
  return getAllActionItemsForUserUncached(userId);
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
    // Ensure userId is always set (required for collection group queries)
    userId,
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

