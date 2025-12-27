/**
 * React Big Calendar Style Getters
 * Maps calendar events to visual styles based on event type
 */

import { CalendarEvent } from "@/types/firestore";
import { Event } from "react-big-calendar";

/**
 * Event type union - semantic types for coaching calendar
 */
export type CalendarEventType =
  | "session" // Coaching session
  | "follow_up" // Touchpoint/follow-up
  | "prep" // Prep/reflection
  | "admin" // Ops/admin
  | "focus" // Deep work/writing
  | "hold"; // Placeholder/hold

/**
 * Infer event type from CalendarEvent
 * Uses heuristics based on event properties
 */
export function inferEventType(event: CalendarEvent): CalendarEventType {
  // Touchpoints are always follow-ups
  if (event.sourceOfTruth === "crm_touchpoint") {
    return "follow_up";
  }

  const titleLower = event.title.toLowerCase();
  const descriptionLower = (event.description || "").toLowerCase();

  // Check for hold/placeholder indicators
  if (
    titleLower.includes("hold") ||
    titleLower.includes("tentative") ||
    titleLower.includes("tbd") ||
    titleLower.includes("block")
  ) {
    return "hold";
  }

  // Check for focus/deep work indicators
  if (
    titleLower.includes("focus") ||
    titleLower.includes("deep work") ||
    titleLower.includes("writing") ||
    titleLower.includes("thinking") ||
    titleLower.includes("prep time")
  ) {
    return "focus";
  }

  // Check for prep/reflection indicators
  if (
    titleLower.includes("prep") ||
    titleLower.includes("preparation") ||
    titleLower.includes("review") ||
    titleLower.includes("reflection") ||
    titleLower.includes("planning")
  ) {
    return "prep";
  }

  // Check for admin/ops indicators
  if (
    titleLower.includes("admin") ||
    titleLower.includes("ops") ||
    titleLower.includes("internal") ||
    titleLower.includes("team meeting") ||
    titleLower.includes("standup")
  ) {
    return "admin";
  }

  // Check for session indicators (coaching sessions)
  if (
    titleLower.includes("session") ||
    titleLower.includes("coaching") ||
    titleLower.includes("call") ||
    titleLower.includes("meeting") ||
    event.matchedContactId // Linked to a contact - likely a session
  ) {
    return "session";
  }

  // Default: if linked to contact, assume session; otherwise follow-up
  if (event.matchedContactId) {
    return "session";
  }

  return "follow_up";
}

/**
 * Get event props for React Big Calendar
 * Returns className and style based on event type
 * Also includes legacy classes for backward compatibility with existing CSS
 */
export function eventPropGetter(
  event: Event & { resource?: CalendarEvent }
): { className?: string; style?: React.CSSProperties } {
  const calendarEvent = event.resource as CalendarEvent | undefined;
  if (!calendarEvent) {
    return {};
  }

  const eventType = inferEventType(calendarEvent);
  const classes: string[] = [`cal-event`, `cal-event--${eventType}`];

  // Add legacy classes for backward compatibility with existing CSS and tests
  if (calendarEvent.matchedContactId) {
    classes.push("rbc-event-linked");
  }

  if (calendarEvent.sourceOfTruth === "crm_touchpoint") {
    classes.push("rbc-event-touchpoint");
  }

  // Add segment-specific class if contact is linked and has a segment
  if (calendarEvent.contactSnapshot?.segment) {
    const segmentSlug = calendarEvent.contactSnapshot.segment
      .toLowerCase()
      .replace(/\s+/g, "-");
    classes.push(`rbc-event-segment-${segmentSlug}`);
  }

  return {
    className: classes.join(" "),
    style: {
      // CSS variables handle most styling, but we can add minimal overrides here if needed
    },
  };
}

/**
 * Get day props for React Big Calendar
 * Adds class for today column
 */
export function dayPropGetter(date: Date): { className?: string; style?: React.CSSProperties } {
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) {
    return {
      className: "cal-day--today",
    };
  }

  return {};
}

/**
 * Get slot props for React Big Calendar (optional)
 * Can add subtle hover or structural classes
 */
export function slotPropGetter(date: Date): { className?: string; style?: React.CSSProperties } {
  // Minimal - can add hover states or other structural classes if needed
  return {};
}

