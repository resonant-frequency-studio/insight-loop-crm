import { Firestore } from "firebase-admin/firestore";
import { Contact } from "@/types/firestore";

export interface TouchpointReminder {
  contactId: string;
  contactName: string;
  touchpointDate: Date;
  message: string | null;
  daysUntil: number;
  isOverdue: boolean;
}

export interface ReminderSettings {
  reminderDaysBefore: number[]; // e.g., [1, 3, 7] for 1 day, 3 days, and 1 week before
}

const DEFAULT_REMINDER_DAYS = [1, 3, 7]; // 1 day, 3 days, 1 week before

/**
 * Get reminder settings for a user (can be customized per user later)
 */
export function getReminderSettings(userId: string): ReminderSettings {
  // For now, return default settings
  // In the future, this could fetch from Firestore user settings
  return {
    reminderDaysBefore: DEFAULT_REMINDER_DAYS,
  };
}

/**
 * Convert unknown date to Date object
 */
function parseDate(date: unknown): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;
  if (typeof date === "string") return new Date(date);
  if (typeof date === "object" && "toDate" in date) {
    return (date as { toDate: () => Date }).toDate();
  }
  return null;
}

/**
 * Check if a touchpoint date is within reminder window
 */
function isWithinReminderWindow(
  touchpointDate: Date,
  reminderDays: number[],
  now: Date = new Date()
): boolean {
  const daysUntil = Math.ceil(
    (touchpointDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check if it's overdue or within any reminder window
  if (daysUntil < 0) return true; // Overdue

  return reminderDays.some((days) => daysUntil <= days);
}

/**
 * Calculate days until touchpoint
 */
export function getDaysUntilTouchpoint(
  touchpointDate: Date,
  now: Date = new Date()
): number {
  const diffMs = touchpointDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get upcoming touchpoints that need reminders
 */
export async function getTouchpointsNeedingReminders(
  db: Firestore,
  userId: string,
  maxDaysAhead: number = 60
): Promise<TouchpointReminder[]> {
  const settings = getReminderSettings(userId);
  const now = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxDaysAhead);

  // Get all contacts with touchpoints
  const contactsSnapshot = await db
    .collection(`users/${userId}/contacts`)
    .where("nextTouchpointDate", "!=", null)
    .get();

  const reminders: TouchpointReminder[] = [];

  for (const doc of contactsSnapshot.docs) {
    const contact = { ...doc.data(), contactId: doc.id } as Contact & {
      contactId: string;
    };

    const touchpointDate = parseDate(contact.nextTouchpointDate);
    if (!touchpointDate) continue;

    // Only include future dates or overdue
    if (touchpointDate > maxDate) continue;

    const daysUntil = getDaysUntilTouchpoint(touchpointDate, now);
    const isOverdue = daysUntil < 0;

    // Include if overdue or within reminder window
    if (isOverdue || isWithinReminderWindow(touchpointDate, settings.reminderDaysBefore, now)) {
      const contactName =
        [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
        contact.primaryEmail;

      reminders.push({
        contactId: contact.contactId,
        contactName,
        touchpointDate,
        message: contact.nextTouchpointMessage || null,
        daysUntil,
        isOverdue,
      });
    }
  }

  // Sort by date (overdue first, then upcoming)
  reminders.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return a.touchpointDate.getTime() - b.touchpointDate.getTime();
  });

  return reminders;
}

/**
 * Get touchpoints due in the next N days
 */
export async function getUpcomingTouchpoints(
  db: Firestore,
  userId: string,
  daysAhead: number = 60
): Promise<TouchpointReminder[]> {
  const now = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + daysAhead);

  const contactsSnapshot = await db
    .collection(`users/${userId}/contacts`)
    .where("nextTouchpointDate", "!=", null)
    .get();

  const touchpoints: TouchpointReminder[] = [];

  for (const doc of contactsSnapshot.docs) {
    const contact = { ...doc.data(), contactId: doc.id } as Contact & {
      contactId: string;
    };

    const touchpointDate = parseDate(contact.nextTouchpointDate);
    if (!touchpointDate) continue;

    // Only include future dates within the window
    if (touchpointDate <= now || touchpointDate > maxDate) continue;

    const contactName =
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      contact.primaryEmail;

    touchpoints.push({
      contactId: contact.contactId,
      contactName,
      touchpointDate,
      message: contact.nextTouchpointMessage || null,
      daysUntil: getDaysUntilTouchpoint(touchpointDate, now),
      isOverdue: false,
    });
  }

  // Sort by date
  touchpoints.sort(
    (a, b) => a.touchpointDate.getTime() - b.touchpointDate.getTime()
  );

  return touchpoints;
}

