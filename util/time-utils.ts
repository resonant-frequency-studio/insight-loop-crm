/**
 * Format a timestamp as relative time (e.g., "2 hours ago", "5 minutes ago")
 * More precise than formatContactDate which is designed for dates
 */
export function formatRelativeTime(timestamp: unknown | null): string {
  if (!timestamp) return "Never";

  let dateObj: Date | null = null;

  // Handle ISO date strings
  if (typeof timestamp === "string") {
    dateObj = new Date(timestamp);
    if (isNaN(dateObj.getTime())) {
      return "Never";
    }
  }
  // Handle Firestore Timestamp
  else if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
    dateObj = (timestamp as { toDate: () => Date }).toDate();
  }
  // Handle Firestore Timestamp serialized format
  else if (typeof timestamp === "object" && timestamp !== null && "seconds" in timestamp) {
    const ts = timestamp as { seconds: number; nanoseconds?: number };
    dateObj = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
  }
  // Handle JavaScript Date
  else if (timestamp instanceof Date) {
    dateObj = timestamp;
  }
  // Handle number (timestamp in milliseconds)
  else if (typeof timestamp === "number") {
    dateObj = new Date(timestamp);
    if (isNaN(dateObj.getTime())) {
      return "Never";
    }
  }

  if (!dateObj) return "Never";

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "Just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} ${years === 1 ? "year" : "years"} ago`;
  }
}

