import { adminDb } from "@/lib/firebase-admin";
import { Contact, ActionItem, Thread } from "@/types/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { reportException } from "@/lib/error-reporting";
import { ErrorLevel } from "@/lib/error-reporting";
import { actionItemsPath } from "@/lib/action-items";

export interface MergeResult {
  success: boolean;
  primaryContactId: string;
  mergedContactIds: string[];
  statistics: {
    actionItemsUpdated: number;
    threadsUpdated: number;
    calendarEventsUpdated: number;
    actionItemsMoved: number;
  };
  error?: string;
}

/**
 * Merge multiple contacts into a single primary contact
 * Updates all references (action items, threads, calendar events) and deletes merged contacts
 */
export async function mergeContacts(
  userId: string,
  primaryContactId: string,
  contactIdsToMerge: string[],
  primaryEmail: string
): Promise<MergeResult> {
  const statistics = {
    actionItemsUpdated: 0,
    threadsUpdated: 0,
    calendarEventsUpdated: 0,
    actionItemsMoved: 0,
  };

  try {
    // Validate inputs
    if (!primaryContactId || !contactIdsToMerge || contactIdsToMerge.length === 0) {
      throw new Error("Primary contact ID and at least one contact to merge are required");
    }

    if (contactIdsToMerge.includes(primaryContactId)) {
      throw new Error("Cannot merge a contact into itself");
    }

    // Fetch all contacts
    const allContactIds = [primaryContactId, ...contactIdsToMerge];
    const contactsMap = new Map<string, Contact>();

    for (const contactId of allContactIds) {
      const doc = await adminDb
        .collection("users")
        .doc(userId)
        .collection("contacts")
        .doc(contactId)
        .get();

      if (!doc.exists) {
        throw new Error(`Contact ${contactId} not found`);
      }

      const contact = doc.data() as Contact;
      contactsMap.set(contactId, contact);
    }

    const primaryContact = contactsMap.get(primaryContactId);
    if (!primaryContact) {
      throw new Error("Primary contact not found");
    }

    // Collect all emails from all contacts
    const allEmails = new Set<string>();
    for (const contact of contactsMap.values()) {
      if (contact.primaryEmail) {
        allEmails.add(contact.primaryEmail.toLowerCase().trim());
      }
      if (contact.secondaryEmails && Array.isArray(contact.secondaryEmails)) {
        contact.secondaryEmails.forEach((email) => {
          if (email) {
            allEmails.add(email.toLowerCase().trim());
          }
        });
      }
    }

    // Validate that primary email exists in collected emails
    if (!allEmails.has(primaryEmail.toLowerCase().trim())) {
      throw new Error("Selected primary email must be from one of the contacts being merged");
    }

    // Set primary email and secondary emails
    const primaryEmailLower = primaryEmail.toLowerCase().trim();
    const secondaryEmails = Array.from(allEmails)
      .filter((email) => email !== primaryEmailLower)
      .sort();

    // Merge contact fields intelligently
    const mergedContact: Partial<Contact> = {
      primaryEmail: primaryEmail,
      secondaryEmails: secondaryEmails.length > 0 ? secondaryEmails : undefined,
    };

    // Merge firstName, lastName, company - use most complete/non-null value
    const firstNameValues = Array.from(contactsMap.values())
      .map((c) => c.firstName)
      .filter((v) => v && v.trim() !== "");
    if (firstNameValues.length > 0) {
      mergedContact.firstName = firstNameValues[0]; // Use first non-null
    }

    const lastNameValues = Array.from(contactsMap.values())
      .map((c) => c.lastName)
      .filter((v) => v && v.trim() !== "");
    if (lastNameValues.length > 0) {
      mergedContact.lastName = lastNameValues[0];
    }

    const companyValues = Array.from(contactsMap.values())
      .map((c) => c.company)
      .filter((v) => v && v.trim() !== "");
    if (companyValues.length > 0) {
      mergedContact.company = companyValues[0];
    }

    // Merge photoUrl - use first non-null
    const photoUrlValues = Array.from(contactsMap.values())
      .map((c) => c.photoUrl)
      .filter((v) => v && v.trim() !== "");
    if (photoUrlValues.length > 0) {
      mergedContact.photoUrl = photoUrlValues[0];
    }

    // Merge tags - combine and deduplicate
    const allTags = new Set<string>();
    for (const contact of contactsMap.values()) {
      if (contact.tags && Array.isArray(contact.tags)) {
        contact.tags.forEach((tag) => {
          if (tag && tag.trim() !== "") {
            allTags.add(tag.trim());
          }
        });
      }
    }
    mergedContact.tags = Array.from(allTags).sort();

    // Merge notes - combine with separator
    const notesValues = Array.from(contactsMap.values())
      .map((c) => c.notes)
      .filter((v) => v && v.trim() !== "");
    if (notesValues.length > 0) {
      mergedContact.notes = notesValues.join("\n\n---\n\n");
    }

    // Merge summary, actionItems, sentiment, etc. - combine with separator
    const summaryValues = Array.from(contactsMap.values())
      .map((c) => c.summary)
      .filter((v) => v && v.trim() !== "");
    if (summaryValues.length > 0) {
      mergedContact.summary = summaryValues.join("\n\n---\n\n");
    }

    const actionItemsValues = Array.from(contactsMap.values())
      .map((c) => c.actionItems)
      .filter((v) => v && v.trim() !== "");
    if (actionItemsValues.length > 0) {
      mergedContact.actionItems = actionItemsValues.join("\n\n---\n\n");
    }

    const sentimentValues = Array.from(contactsMap.values())
      .map((c) => c.sentiment)
      .filter((v) => v && v.trim() !== "");
    if (sentimentValues.length > 0) {
      mergedContact.sentiment = sentimentValues[0]; // Use first non-null
    }

    const relationshipInsightsValues = Array.from(contactsMap.values())
      .map((c) => c.relationshipInsights)
      .filter((v) => v && v.trim() !== "");
    if (relationshipInsightsValues.length > 0) {
      mergedContact.relationshipInsights = relationshipInsightsValues.join("\n\n---\n\n");
    }

    const painPointsValues = Array.from(contactsMap.values())
      .map((c) => c.painPoints)
      .filter((v) => v && v.trim() !== "");
    if (painPointsValues.length > 0) {
      mergedContact.painPoints = painPointsValues.join("\n\n---\n\n");
    }

    const coachingThemesValues = Array.from(contactsMap.values())
      .map((c) => c.coachingThemes)
      .filter((v) => v && v.trim() !== "");
    if (coachingThemesValues.length > 0) {
      mergedContact.coachingThemes = coachingThemesValues.join("\n\n---\n\n");
    }

    const outreachDraftValues = Array.from(contactsMap.values())
      .map((c) => c.outreachDraft)
      .filter((v) => v && v.trim() !== "");
    if (outreachDraftValues.length > 0) {
      mergedContact.outreachDraft = outreachDraftValues[0]; // Use primary contact's draft
    }

    // Merge segment - use primary contact's segment (or first non-null)
    const segmentValues = Array.from(contactsMap.values())
      .map((c) => c.segment)
      .filter((v) => v && v.trim() !== "");
    if (segmentValues.length > 0) {
      mergedContact.segment = primaryContact.segment || segmentValues[0];
    }

    // Merge leadSource - use primary contact's leadSource (or first non-null)
    const leadSourceValues = Array.from(contactsMap.values())
      .map((c) => c.leadSource)
      .filter((v) => v && v.trim() !== "");
    if (leadSourceValues.length > 0) {
      mergedContact.leadSource = primaryContact.leadSource || leadSourceValues[0];
    }

    // Merge engagementScore - use highest score
    const engagementScores = Array.from(contactsMap.values())
      .map((c) => c.engagementScore)
      .filter((v) => v !== null && v !== undefined) as number[];
    if (engagementScores.length > 0) {
      mergedContact.engagementScore = Math.max(...engagementScores);
    }

    // Merge threadCount - sum all thread counts
    const threadCounts = Array.from(contactsMap.values())
      .map((c) => c.threadCount || 0)
      .filter((v) => typeof v === "number");
    if (threadCounts.length > 0) {
      mergedContact.threadCount = threadCounts.reduce((sum, count) => sum + count, 0);
    }

    // Merge lastEmailDate - use most recent date
    const lastEmailDates = Array.from(contactsMap.values())
      .map((c) => c.lastEmailDate)
      .filter((v) => v !== null && v !== undefined);
    if (lastEmailDates.length > 0) {
      // Convert to Date objects and find most recent
      const dates = lastEmailDates
        .map((d) => {
          if (d instanceof Timestamp) {
            return d.toDate();
          }
          if (typeof d === "string") {
            return new Date(d);
          }
          if (d && typeof d === "object" && "toDate" in d) {
            return (d as { toDate: () => Date }).toDate();
          }
          return null;
        })
        .filter((d) => d !== null) as Date[];
      if (dates.length > 0) {
        const mostRecent = dates.reduce((latest, current) =>
          current > latest ? current : latest
        );
        mergedContact.lastEmailDate = Timestamp.fromDate(mostRecent);
      }
    }

    // Merge nextTouchpointDate - use earliest upcoming date (or most recent if all past)
    const nextTouchpointDates = Array.from(contactsMap.values())
      .map((c) => c.nextTouchpointDate)
      .filter((v) => v !== null && v !== undefined);
    if (nextTouchpointDates.length > 0) {
      const now = new Date();
      const dates = nextTouchpointDates
        .map((d) => {
          if (d instanceof Timestamp) {
            return d.toDate();
          }
          if (typeof d === "string") {
            return new Date(d);
          }
          if (d && typeof d === "object" && "toDate" in d) {
            return (d as { toDate: () => Date }).toDate();
          }
          return null;
        })
        .filter((d) => d !== null) as Date[];

      if (dates.length > 0) {
        const upcomingDates = dates.filter((d) => d >= now);
        if (upcomingDates.length > 0) {
          const earliest = upcomingDates.reduce((earliest, current) =>
            current < earliest ? current : earliest
          );
          mergedContact.nextTouchpointDate = Timestamp.fromDate(earliest);
        } else {
          // All dates are past, use most recent
          const mostRecent = dates.reduce((latest, current) =>
            current > latest ? current : latest
          );
          mergedContact.nextTouchpointDate = Timestamp.fromDate(mostRecent);
        }
      }
    }

    // Merge nextTouchpointMessage - use primary contact's message (or first non-null)
    const nextTouchpointMessageValues = Array.from(contactsMap.values())
      .map((c) => c.nextTouchpointMessage)
      .filter((v) => v && v.trim() !== "");
    if (nextTouchpointMessageValues.length > 0) {
      mergedContact.nextTouchpointMessage =
        primaryContact.nextTouchpointMessage || nextTouchpointMessageValues[0];
    }

    // Merge touchpointStatus - use primary contact's status (or first non-null)
    const touchpointStatusValues = Array.from(contactsMap.values())
      .map((c) => c.touchpointStatus)
      .filter((v) => v !== null && v !== undefined);
    if (touchpointStatusValues.length > 0) {
      mergedContact.touchpointStatus =
        primaryContact.touchpointStatus || touchpointStatusValues[0];
    }

    // Merge linkedGoogleEventId, linkedGoogleCalendarId - use primary contact's values
    if (primaryContact.linkedGoogleEventId) {
      mergedContact.linkedGoogleEventId = primaryContact.linkedGoogleEventId;
    }
    if (primaryContact.linkedGoogleCalendarId) {
      mergedContact.linkedGoogleCalendarId = primaryContact.linkedGoogleCalendarId;
    }
    if (primaryContact.linkStatus) {
      mergedContact.linkStatus = primaryContact.linkStatus;
    }

    // Merge createdAt - use earliest date
    const createdAtValues = Array.from(contactsMap.values())
      .map((c) => c.createdAt)
      .filter((v) => v !== null && v !== undefined);
    if (createdAtValues.length > 0) {
      const dates = createdAtValues
        .map((d) => {
          if (d instanceof Timestamp) {
            return d.toDate();
          }
          if (typeof d === "string") {
            return new Date(d);
          }
          if (d && typeof d === "object" && "toDate" in d) {
            return (d as { toDate: () => Date }).toDate();
          }
          return null;
        })
        .filter((d) => d !== null) as Date[];
      if (dates.length > 0) {
        const earliest = dates.reduce((earliest, current) =>
          current < earliest ? current : earliest
        );
        mergedContact.createdAt = Timestamp.fromDate(earliest);
      }
    }

    // Set updatedAt to current timestamp
    mergedContact.updatedAt = FieldValue.serverTimestamp();

    // Use Firestore transaction to update all references atomically
    await adminDb.runTransaction(async (transaction) => {
      // Update action items
      const actionItemsResult = await updateActionItemsOnMerge(
        userId,
        primaryContactId,
        contactIdsToMerge,
        transaction
      );
      statistics.actionItemsUpdated = actionItemsResult.updated;

      // Update threads
      const threadsResult = await updateThreadsOnMerge(
        userId,
        primaryContactId,
        contactIdsToMerge,
        transaction
      );
      statistics.threadsUpdated = threadsResult.updated;

      // Update calendar events
      const calendarEventsResult = await updateCalendarEventsOnMerge(
        userId,
        primaryContactId,
        contactIdsToMerge,
        transaction
      );
      statistics.calendarEventsUpdated = calendarEventsResult.updated;

      // Move action items subcollection
      const actionItemsMovedResult = await moveActionItemsSubcollection(
        userId,
        primaryContactId,
        contactIdsToMerge,
        transaction
      );
      statistics.actionItemsMoved = actionItemsMovedResult.moved;

      // Update primary contact
      const primaryContactRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("contacts")
        .doc(primaryContactId);
      transaction.update(primaryContactRef, mergedContact);

      // Delete merged contacts (and their subcollections will be handled by Firestore rules or cleanup)
      for (const contactId of contactIdsToMerge) {
        const mergedContactRef = adminDb
          .collection("users")
          .doc(userId)
          .collection("contacts")
          .doc(contactId);
        transaction.delete(mergedContactRef);
      }
    });

    return {
      success: true,
      primaryContactId,
      mergedContactIds: contactIdsToMerge,
      statistics,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    reportException(error, {
      context: "Error merging contacts",
      tags: { component: "merge-contacts", userId, primaryContactId },
      extra: { contactIdsToMerge },
      level: ErrorLevel.ERROR,
    });

    return {
      success: false,
      primaryContactId,
      mergedContactIds: contactIdsToMerge,
      statistics,
      error: errorMessage,
    };
  }
}

/**
 * Update action items to point to primary contact
 */
async function updateActionItemsOnMerge(
  userId: string,
  primaryContactId: string,
  mergedContactIds: string[],
  transaction: FirebaseFirestore.Transaction
): Promise<{ updated: number }> {
  let updated = 0;

  // Query action items for each merged contact individually (avoids collection group index requirement)
  for (const mergedContactId of mergedContactIds) {
    const actionItemsSnapshot = await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(mergedContactId)
      .collection("actionItems")
      .get();

    for (const doc of actionItemsSnapshot.docs) {
      const actionItem = doc.data() as ActionItem;
      // Update the contactId field
      transaction.update(doc.ref, {
        contactId: primaryContactId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updated++;
    }
  }

  return { updated };
}

/**
 * Update threads to remove merged contactIds and add primary contactId
 */
async function updateThreadsOnMerge(
  userId: string,
  primaryContactId: string,
  mergedContactIds: string[],
  transaction: FirebaseFirestore.Transaction
): Promise<{ updated: number }> {
  let updated = 0;

  // Get all threads that reference any of the merged contacts
  const threadsSnapshot = await adminDb
    .collection("users")
    .doc(userId)
    .collection("threads")
    .get();

  for (const doc of threadsSnapshot.docs) {
    const thread = doc.data() as Thread;
    const contactIds = thread.contactIds || [];

    // Check if any merged contactIds are in this thread's contactIds array
    const hasMergedContact = mergedContactIds.some((id) => contactIds.includes(id));
    const hasPrimaryContact = contactIds.includes(primaryContactId);

    if (hasMergedContact) {
      // Remove merged contactIds and add primary contactId if not present
      const updatedContactIds = contactIds
        .filter((id) => !mergedContactIds.includes(id))
        .filter((id, index, self) => self.indexOf(id) === index); // Deduplicate

      if (!hasPrimaryContact) {
        updatedContactIds.push(primaryContactId);
      }

      transaction.update(doc.ref, {
        contactIds: updatedContactIds,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updated++;
    }
  }

  return { updated };
}

/**
 * Update calendar events to point to primary contact
 */
async function updateCalendarEventsOnMerge(
  userId: string,
  primaryContactId: string,
  mergedContactIds: string[],
  transaction: FirebaseFirestore.Transaction
): Promise<{ updated: number }> {
  let updated = 0;

  // Get all calendar events that reference any of the merged contacts
  for (const mergedContactId of mergedContactIds) {
    const eventsSnapshot = await adminDb
      .collection("users")
      .doc(userId)
      .collection("calendarEvents")
      .where("matchedContactId", "==", mergedContactId)
      .get();

    for (const doc of eventsSnapshot.docs) {
      transaction.update(doc.ref, {
        matchedContactId: primaryContactId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updated++;
    }
  }

  return { updated };
}

/**
 * Move action items from merged contacts to primary contact
 */
async function moveActionItemsSubcollection(
  userId: string,
  primaryContactId: string,
  mergedContactIds: string[],
  transaction: FirebaseFirestore.Transaction
): Promise<{ moved: number }> {
  let moved = 0;

  // For each merged contact, get all action items and move them to primary contact
  for (const mergedContactId of mergedContactIds) {
    const actionItemsSnapshot = await adminDb
      .collection(actionItemsPath(userId, mergedContactId))
      .get();

    for (const doc of actionItemsSnapshot.docs) {
      const actionItem = doc.data() as ActionItem;
      const newPath = actionItemsPath(userId, primaryContactId);

      // Create new action item in primary contact's subcollection
      const newActionItemRef = adminDb.collection(newPath).doc(doc.id);
      transaction.set(newActionItemRef, {
        ...actionItem,
        contactId: primaryContactId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Delete old action item
      transaction.delete(doc.ref);
      moved++;
    }
  }

  return { moved };
}

