import { Firestore, Timestamp } from "firebase-admin/firestore";
import { CalendarEvent } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

const SYNC_LOCK_DURATION_SECONDS = 30; // Lock events for 30 seconds during sync
const SYNC_COOLDOWN_SECONDS = 30; // Don't re-sync if synced within last 30 seconds

/**
 * Check if an event is locked (currently being synced)
 */
export function isEventLocked(event: CalendarEvent): boolean {
  if (!event.syncLockUntil) {
    return false;
  }

  let lockUntil: Date;
  if (event.syncLockUntil instanceof Timestamp) {
    lockUntil = event.syncLockUntil.toDate();
  } else if (event.syncLockUntil instanceof Date) {
    lockUntil = event.syncLockUntil;
  } else if (typeof event.syncLockUntil === "object" && "toDate" in event.syncLockUntil) {
    lockUntil = (event.syncLockUntil as { toDate: () => Date }).toDate();
  } else {
    return false;
  }

  return lockUntil > new Date();
}

/**
 * Check if an event was recently synced from the opposite direction
 */
export function wasRecentlySyncedFromOppositeDirection(
  event: CalendarEvent,
  syncDirection: "google" | "crm"
): boolean {
  if (!event.lastSyncedFrom || !event.lastSyncedAt) {
    return false;
  }

  // If last sync was from the same direction, allow sync
  if (event.lastSyncedFrom === syncDirection) {
    return false;
  }

  // Check if last sync was recent
  let lastSyncedAt: Date;
  if (event.lastSyncedAt instanceof Timestamp) {
    lastSyncedAt = event.lastSyncedAt.toDate();
  } else if (event.lastSyncedAt instanceof Date) {
    lastSyncedAt = event.lastSyncedAt;
  } else if (typeof event.lastSyncedAt === "object" && "toDate" in event.lastSyncedAt) {
    lastSyncedAt = (event.lastSyncedAt as { toDate: () => Date }).toDate();
  } else {
    return false;
  }

  const now = new Date();
  const timeSinceLastSync = (now.getTime() - lastSyncedAt.getTime()) / 1000; // seconds

  return timeSinceLastSync < SYNC_COOLDOWN_SECONDS;
}

/**
 * Lock an event to prevent concurrent syncs
 */
export async function lockEventForSync(
  db: Firestore,
  userId: string,
  eventId: string
): Promise<boolean> {
  try {
    const eventsCollection = db
      .collection("users")
      .doc(userId)
      .collection("calendarEvents");

    const eventDoc = await eventsCollection.doc(eventId).get();
    if (!eventDoc.exists) {
      return false;
    }

    const event = eventDoc.data() as CalendarEvent;

    // Check if event is already locked
    if (isEventLocked(event)) {
      return false;
    }

    // Check if event is already being synced
    if (event.syncInProgress === true) {
      return false;
    }

    // Lock the event
    const lockUntil = new Date();
    lockUntil.setSeconds(lockUntil.getSeconds() + SYNC_LOCK_DURATION_SECONDS);

    await eventsCollection.doc(eventId).update({
      syncInProgress: true,
      syncLockUntil: Timestamp.fromDate(lockUntil),
      lastSyncAttempt: Timestamp.now(),
    });

    return true;
  } catch (error) {
    reportException(error, {
      context: "Locking event for sync",
      tags: { component: "sync-state-tracker", userId, eventId },
    });
    return false;
  }
}

/**
 * Unlock an event after sync completes
 */
export async function unlockEventAfterSync(
  db: Firestore,
  userId: string,
  eventId: string,
  syncDirection: "google" | "crm",
  success: boolean
): Promise<void> {
  try {
    const eventsCollection = db
      .collection("users")
      .doc(userId)
      .collection("calendarEvents");

    const updateData: Partial<CalendarEvent> = {
      syncInProgress: false,
      syncLockUntil: null,
    };

    if (success) {
      updateData.lastSyncedFrom = syncDirection;
      updateData.lastSyncedAt = Timestamp.now();
    }

    await eventsCollection.doc(eventId).update(updateData);
  } catch (error) {
    reportException(error, {
      context: "Unlocking event after sync",
      tags: { component: "sync-state-tracker", userId, eventId },
    });
  }
}

/**
 * Check if an event can be synced (not locked, not recently synced from opposite direction)
 */
export function canSyncEvent(
  event: CalendarEvent,
  syncDirection: "google" | "crm"
): { canSync: boolean; reason?: string } {
  // Check if event is locked
  if (isEventLocked(event)) {
    return { canSync: false, reason: "Event is locked" };
  }

  // Check if event is already being synced
  if (event.syncInProgress === true) {
    return { canSync: false, reason: "Event is already being synced" };
  }

  // Check if event was recently synced from opposite direction
  if (wasRecentlySyncedFromOppositeDirection(event, syncDirection)) {
    return {
      canSync: false,
      reason: "Event was recently synced from opposite direction",
    };
  }

  return { canSync: true };
}

