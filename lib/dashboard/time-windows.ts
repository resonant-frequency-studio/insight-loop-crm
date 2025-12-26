/**
 * Dashboard time window utilities
 * 
 * Dashboard focuses on "Today & This Week" with:
 * - Primary window: last 30 days (recent conversations / engagement)
 * - Secondary window: last 60 days (optional context)
 */

/**
 * Get the date 30 days ago (primary dashboard window)
 */
export function getPrimaryWindowStart(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date;
}

/**
 * Get the date 60 days ago (secondary dashboard window)
 */
export function getSecondaryWindowStart(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 60);
  return date;
}

/**
 * Check if a date is within the primary window (last 30 days)
 */
export function isWithinPrimaryWindow(date: Date | null | undefined): boolean {
  if (!date) return false;
  const primaryStart = getPrimaryWindowStart();
  return date >= primaryStart;
}

/**
 * Check if a date is within the secondary window (last 60 days)
 */
export function isWithinSecondaryWindow(date: Date | null | undefined): boolean {
  if (!date) return false;
  const secondaryStart = getSecondaryWindowStart();
  return date >= secondaryStart;
}

/**
 * Convert various date formats to Date object
 */
export function toDate(date: unknown | null): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;
  if (typeof date === "string") {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof date === "object" && "toDate" in date) {
    return (date as { toDate: () => Date }).toDate();
  }
  if (typeof date === "object" && date !== null && "seconds" in date) {
    const ts = date as { seconds: number; nanoseconds?: number };
    return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
  }
  if (typeof date === "object" && date !== null && "_seconds" in date) {
    const ts = date as { _seconds: number; _nanoseconds?: number };
    return new Date(ts._seconds * 1000 + (ts._nanoseconds || 0) / 1000000);
  }
  return null;
}

