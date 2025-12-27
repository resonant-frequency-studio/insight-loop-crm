import { CalendarEvent } from "@/types/firestore";
import { GoogleCalendarEvent } from "./google-calendar-client";
import { Timestamp } from "firebase-admin/firestore";

export type ConflictType = "none" | "simple" | "complex";

export interface ConflictInfo {
  type: ConflictType;
  reason?: string;
  googleChanged: boolean;
  crmChanged: boolean;
  googleUpdated?: Date;
  crmUpdated?: Date;
}

/**
 * Detect if there's a conflict between a Google Calendar event and a CRM event
 */
export function detectConflict(
  googleEvent: GoogleCalendarEvent,
  crmEvent: CalendarEvent
): ConflictInfo {
  // Get timestamps
  const googleUpdated = googleEvent.updated
    ? new Date(googleEvent.updated)
    : undefined;

  let crmUpdated: Date | undefined;
  if (crmEvent.updatedAt) {
    if (crmEvent.updatedAt instanceof Timestamp) {
      crmUpdated = crmEvent.updatedAt.toDate();
    } else if (crmEvent.updatedAt instanceof Date) {
      crmUpdated = crmEvent.updatedAt;
    } else if (typeof crmEvent.updatedAt === "object" && "toDate" in crmEvent.updatedAt) {
      crmUpdated = (crmEvent.updatedAt as { toDate: () => Date }).toDate();
    }
  }

  // If we don't have timestamps, can't detect conflict
  if (!googleUpdated || !crmUpdated) {
    return {
      type: "none",
      googleChanged: false,
      crmChanged: false,
    };
  }

  // Check if CRM event is dirty (has unsynced changes)
  const isDirty = crmEvent.isDirty === true;

  // Calculate time difference in milliseconds
  const timeDiff = Math.abs(googleUpdated.getTime() - crmUpdated.getTime());
  const oneMinute = 60 * 1000;

  // If timestamps are very close (< 1 minute), likely same update, no conflict
  if (timeDiff < oneMinute) {
    return {
      type: "none",
      googleChanged: false,
      crmChanged: false,
      googleUpdated,
      crmUpdated,
    };
  }

  // Determine which side changed
  const googleChanged = googleUpdated > crmUpdated;
  const crmChanged = isDirty && crmUpdated > googleUpdated;

  // Simple conflict: only one side changed
  if (googleChanged && !crmChanged) {
    return {
      type: "simple",
      reason: "only_google_changed",
      googleChanged: true,
      crmChanged: false,
      googleUpdated,
      crmUpdated,
    };
  }

  if (crmChanged && !googleChanged) {
    return {
      type: "simple",
      reason: "only_crm_changed",
      googleChanged: false,
      crmChanged: true,
      googleUpdated,
      crmUpdated,
    };
  }

  // Complex conflict: both sides changed
  if (googleChanged && crmChanged) {
    return {
      type: "complex",
      reason: "both_changed",
      googleChanged: true,
      crmChanged: true,
      googleUpdated,
      crmUpdated,
    };
  }

  // No conflict
  return {
    type: "none",
    googleChanged: false,
    crmChanged: false,
    googleUpdated,
    crmUpdated,
  };
}

/**
 * Check if fields differ between Google and CRM events
 */
export function getChangedFields(
  googleEvent: GoogleCalendarEvent,
  crmEvent: CalendarEvent
): string[] {
  const changedFields: string[] = [];

  // Compare title
  if (googleEvent.summary !== crmEvent.title) {
    changedFields.push("title");
  }

  // Compare description
  const googleDesc = googleEvent.description ?? null;
  const crmDesc = crmEvent.description ?? null;
  if (googleDesc !== crmDesc) {
    changedFields.push("description");
  }

  // Compare location
  const googleLoc = googleEvent.location ?? null;
  const crmLoc = crmEvent.location ?? null;
  if (googleLoc !== crmLoc) {
    changedFields.push("location");
  }

  // Compare start time
  const googleStart = googleEvent.start.dateTime || googleEvent.start.date;
  let crmStart: string | undefined;
  if (crmEvent.startTime) {
    if (crmEvent.startTime instanceof Timestamp) {
      crmStart = crmEvent.startTime.toDate().toISOString();
    } else if (crmEvent.startTime instanceof Date) {
      crmStart = crmEvent.startTime.toISOString();
    } else if (typeof crmEvent.startTime === "object" && "toDate" in crmEvent.startTime) {
      crmStart = (crmEvent.startTime as { toDate: () => Date }).toDate().toISOString();
    }
  }
  if (googleStart !== crmStart) {
    changedFields.push("startTime");
  }

  // Compare end time
  const googleEnd = googleEvent.end.dateTime || googleEvent.end.date;
  let crmEnd: string | undefined;
  if (crmEvent.endTime) {
    if (crmEvent.endTime instanceof Timestamp) {
      crmEnd = crmEvent.endTime.toDate().toISOString();
    } else if (crmEvent.endTime instanceof Date) {
      crmEnd = crmEvent.endTime.toISOString();
    } else if (typeof crmEvent.endTime === "object" && "toDate" in crmEvent.endTime) {
      crmEnd = (crmEvent.endTime as { toDate: () => Date }).toDate().toISOString();
    }
  }
  if (googleEnd !== crmEnd) {
    changedFields.push("endTime");
  }

  // Compare attendees
  const googleAttendees = new Set(
    (googleEvent.attendees || []).map((a) => a.email.toLowerCase())
  );
  const crmAttendees = new Set(
    (crmEvent.attendees || []).map((a) => a.email.toLowerCase())
  );

  if (
    googleAttendees.size !== crmAttendees.size ||
    [...googleAttendees].some((email) => !crmAttendees.has(email))
  ) {
    changedFields.push("attendees");
  }

  return changedFields;
}

