import { Timestamp } from "firebase/firestore";

/**
 * Normalize a date value from various formats to a Date object or null
 * Handles Firestore Timestamps, ISO strings, Date objects, and numbers
 */
export function normalizeDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (value instanceof Timestamp) return value.toDate();

  if (typeof value === "string") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Normalize an ActionItem's date fields from API responses
 * API returns ISO strings, but we need Date objects for calculations
 */
export function normalizeActionItem(raw: any): any {
  return {
    ...raw,
    dueDate: normalizeDate(raw.dueDate),
    createdAt: normalizeDate(raw.createdAt),
    updatedAt: normalizeDate(raw.updatedAt),
    completedAt: raw.completedAt ? normalizeDate(raw.completedAt) : null,
  };
}

