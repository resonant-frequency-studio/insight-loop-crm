import { adminDb } from "@/lib/firebase-admin";
import { ActionItem } from "@/types/firestore";
import { serverTimestamp } from "firebase-admin/firestore";

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
 * Get all action items for a contact
 */
export async function getActionItemsForContact(
  userId: string,
  contactId: string
): Promise<ActionItem[]> {
  const snapshot = await adminDb
    .collection(actionItemsPath(userId, contactId))
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => ({
    ...(doc.data() as ActionItem),
    actionItemId: doc.id,
  }));
}

/**
 * Get all action items for a user (across all contacts)
 * Returns action items with contactId included
 */
export async function getAllActionItemsForUser(
  userId: string
): Promise<Array<ActionItem & { contactId: string }>> {
  // Get all contacts first
  const contactsSnapshot = await adminDb
    .collection(`users/${userId}/contacts`)
    .get();

  const allActionItems: Array<ActionItem & { contactId: string }> = [];

  // Fetch action items for each contact
  for (const contactDoc of contactsSnapshot.docs) {
    const contactId = contactDoc.id;
    const actionItems = await getActionItemsForContact(userId, contactId);
    // Add contactId to each action item
    actionItems.forEach((item) => {
      allActionItems.push({ ...item, contactId });
    });
  }

  return allActionItems.sort((a, b) => {
    const aTime =
      typeof a.createdAt === "object" && "toMillis" in a.createdAt
        ? (a.createdAt as { toMillis: () => number }).toMillis()
        : typeof a.createdAt === "number"
        ? a.createdAt
        : 0;
    const bTime =
      typeof b.createdAt === "object" && "toMillis" in b.createdAt
        ? (b.createdAt as { toMillis: () => number }).toMillis()
        : typeof b.createdAt === "number"
        ? b.createdAt
        : 0;
    return bTime - aTime;
  });
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

  return {
    ...(doc.data() as ActionItem),
    actionItemId: doc.id,
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

  const now = serverTimestamp();
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
    updatedAt: serverTimestamp(),
  };

  if (updates.text !== undefined) {
    updateData.text = updates.text;
  }

  if (updates.status !== undefined) {
    updateData.status = updates.status;
    if (updates.status === "completed") {
      updateData.completedAt = serverTimestamp();
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

