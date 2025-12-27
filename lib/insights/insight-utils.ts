import { Contact } from "@/types/firestore";

/**
 * Convert Firestore timestamp to Date
 */
function toDate(date: unknown | null): Date | null {
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

/**
 * Filter contacts to only include those with recent activity (within 90 days)
 * This ensures insights focus on active relationships
 */
function filterRecentContacts(contacts: Contact[]): Contact[] {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  return contacts.filter((contact) => {
    if (!contact.lastEmailDate) return false; // No email history = not recent
    const lastEmail = toDate(contact.lastEmailDate);
    if (!lastEmail) return false;
    return lastEmail >= ninetyDaysAgo;
  });
}

/**
 * Check if a contact needs attention based on multiple criteria
 * Only includes contacts with activity within the last 90 days
 */
export function getRelationshipsNeedingAttention(contacts: Contact[]): {
  count: number;
  contactIds: string[];
  breakdown?: { lowEngagement: number; overdueTouchpoint: number; negativeSentiment: number };
} {
  const recentContacts = filterRecentContacts(contacts);
  const now = new Date();

  let lowEngagementCount = 0;
  let overdueTouchpointCount = 0;
  let negativeSentimentCount = 0;

  const needsAttention = recentContacts.filter((contact) => {
    // Low engagement (score < 40 or null/0)
    const hasLowEngagement =
      !contact.engagementScore || contact.engagementScore < 40;
    if (hasLowEngagement) lowEngagementCount++;

    // Overdue touchpoint
    const hasOverdueTouchpoint =
      contact.touchpointStatus === "pending" &&
      contact.nextTouchpointDate &&
      (() => {
        const touchpointDate = toDate(contact.nextTouchpointDate);
        return touchpointDate && touchpointDate < now;
      })();
    if (hasOverdueTouchpoint) overdueTouchpointCount++;

    // Negative sentiment
    const hasNegativeSentiment =
      contact.sentiment === "Negative" || contact.sentiment === "Very Negative";
    if (hasNegativeSentiment) negativeSentimentCount++;

    return (
      hasLowEngagement ||
      hasOverdueTouchpoint ||
      hasNegativeSentiment
    );
  });

  return {
    count: needsAttention.length,
    contactIds: needsAttention.map((c) => c.contactId),
    breakdown: {
      lowEngagement: lowEngagementCount,
      overdueTouchpoint: overdueTouchpointCount,
      negativeSentiment: negativeSentimentCount,
    },
  };
}

/**
 * Get count and percentage of contacts missing lead source
 * Only includes contacts with activity within the last 90 days
 */
export function getMissingLeadSourceCount(contacts: Contact[]): {
  count: number;
  percentage: number;
} {
  const recentContacts = filterRecentContacts(contacts);
  const missing = recentContacts.filter(
    (c) => !c.leadSource || c.leadSource.trim() === ""
  );
  const percentage =
    recentContacts.length > 0 ? (missing.length / recentContacts.length) * 100 : 0;
  return {
    count: missing.length,
    percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
  };
}

/**
 * Get segment coverage data
 * Only includes contacts with activity within the last 90 days
 */
export function getSegmentCoverage(contacts: Contact[]): {
  topSegments: Array<{ name: string; count: number; percentage: number }>;
  underrepresented: Array<{ name: string; count: number; percentage: number }>;
} {
  const recentContacts = filterRecentContacts(contacts);
  const segmentCounts = new Map<string, number>();
  const total = recentContacts.length;

  recentContacts.forEach((contact) => {
    const segment = contact.segment || "No Segment";
    segmentCounts.set(segment, (segmentCounts.get(segment) || 0) + 1);
  });

  const segments = Array.from(segmentCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topSegments = segments.slice(0, 2);
  const underrepresented = segments
    .filter((s) => s.count > 0)
    .slice(-1)
    .filter((s) => s.percentage < 20); // Only show if < 20% coverage

  return { topSegments, underrepresented };
}

/**
 * Get quiet relationships (low engagement within recent contacts)
 * Only includes contacts with activity within the last 90 days
 */
export function getAtRiskContacts(contacts: Contact[]): Contact[] {
  const recentContacts = filterRecentContacts(contacts);

  return recentContacts
    .filter((contact) => {
      const hasLowEngagement =
        !contact.engagementScore || contact.engagementScore < 40;
      return hasLowEngagement;
    })
    .sort((a, b) => {
      // Sort by last interaction date (oldest first)
      const dateA = toDate(a.lastEmailDate);
      const dateB = toDate(b.lastEmailDate);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.getTime() - dateB.getTime();
    });
}

/**
 * Get high momentum contacts (high engagement or recent activity)
 * Only includes contacts with activity within the last 90 days
 */
export function getHighMomentumContacts(contacts: Contact[]): Contact[] {
  const recentContacts = filterRecentContacts(contacts);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return recentContacts
    .filter((contact) => {
      // High engagement (score >= 70)
      const hasHighEngagement =
        contact.engagementScore !== null && 
        contact.engagementScore !== undefined && 
        contact.engagementScore >= 70;

      // Recent activity with decent engagement
      const hasRecentActivity =
        contact.lastEmailDate &&
        (() => {
          const lastEmail = toDate(contact.lastEmailDate);
          return (
            lastEmail &&
            lastEmail >= sevenDaysAgo &&
            contact.engagementScore !== null &&
            contact.engagementScore !== undefined &&
            contact.engagementScore >= 50
          );
        })();

      return hasHighEngagement || hasRecentActivity;
    })
    .sort((a, b) => {
      // Sort by engagement score (highest first), then by last email date (most recent first)
      const scoreA = a.engagementScore ?? 0;
      const scoreB = b.engagementScore ?? 0;
      if (scoreA !== scoreB) return scoreB - scoreA;

      const dateA = toDate(a.lastEmailDate);
      const dateB = toDate(b.lastEmailDate);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB.getTime() - dateA.getTime();
    });
}

/**
 * Get contacts with negative sentiment
 * Only includes contacts with activity within the last 90 days
 */
export function getNegativeSentimentContacts(
  contacts: Contact[]
): Contact[] {
  const recentContacts = filterRecentContacts(contacts);
  return recentContacts
    .filter(
      (contact) =>
        contact.sentiment === "Negative" ||
        contact.sentiment === "Very Negative"
    )
    .sort((a, b) => {
      // Sort by last email date (most recent first)
      const dateA = toDate(a.lastEmailDate);
      const dateB = toDate(b.lastEmailDate);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB.getTime() - dateA.getTime();
    });
}

/**
 * Get optional tag suggestions (tags with low coverage)
 * Only includes contacts with activity within the last 90 days
 * Filters out tags with 0% usage
 */
export function getTagCoverageGaps(contacts: Contact[]): Array<{
  tag: string;
  count: number;
  percentage: number;
}> {
  const recentContacts = filterRecentContacts(contacts);
  const tagCounts = new Map<string, number>();
  const total = recentContacts.length;

  recentContacts.forEach((contact) => {
    const tags = contact.tags || [];
    tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({
      tag,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .filter((t) => t.percentage > 0 && t.percentage < 30) // Only show tags with > 0% and < 30% coverage
    .sort((a, b) => a.percentage - b.percentage) // Sort by lowest coverage first
    .slice(0, 3); // Top 3 gaps
}

