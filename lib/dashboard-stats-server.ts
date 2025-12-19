import { getAllContactsForUserUncached } from "./contacts-server";
import { DashboardStats } from "@/hooks/useDashboardStats";
import { reportException } from "./error-reporting";

/**
 * Internal function to calculate dashboard stats (uncached)
 * Uses getAllContactsForUserUncached to avoid nested caching that can exceed Next.js 2MB cache limit
 */
async function getDashboardStatsUncached(userId: string): Promise<DashboardStats> {
  try {
    const contacts = await getAllContactsForUserUncached(userId);

    const totalContacts = contacts.length;
    const contactsWithEmail = contacts.filter((c) => c.primaryEmail).length;
    const contactsWithThreads = contacts.filter((c) => (c.threadCount || 0) > 0).length;

    // Calculate average engagement score
    const scoresWithValues = contacts
      .map((c) => c.engagementScore)
      .filter((score): score is number => typeof score === "number" && score >= 0);
    const averageEngagementScore =
      scoresWithValues.length > 0
        ? scoresWithValues.reduce((sum, score) => sum + score, 0) / scoresWithValues.length
        : 0;

    // Segment distribution - normalize duplicates
    const segmentDistribution: Record<string, number> = {};
    contacts.forEach((contact) => {
      let segment = contact.segment?.trim() || "";
      if (!segment) {
        segment = "Uncategorized";
      }
      // Remove any common prefixes that might cause duplicates
      segment = segment.replace(/^Segment:\s*/i, "").trim() || "Uncategorized";
      segmentDistribution[segment] = (segmentDistribution[segment] || 0) + 1;
    });

    // Lead source distribution - normalize duplicates
    const leadSourceDistribution: Record<string, number> = {};
    contacts.forEach((contact) => {
      let source = contact.leadSource?.trim() || "";
      // Normalize common variations
      if (!source || source.toLowerCase() === "unknown" || source.toLowerCase().includes("unknown")) {
        source = "Unknown";
      }
      // Remove "Lead Source:" prefix if present
      source = source.replace(/^Lead Source:\s*/i, "").trim() || "Unknown";
      leadSourceDistribution[source] = (leadSourceDistribution[source] || 0) + 1;
    });

    // Tag distribution
    const tagDistribution: Record<string, number> = {};
    contacts.forEach((contact) => {
      if (contact.tags && contact.tags.length > 0) {
        contact.tags.forEach((tag) => {
          tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
        });
      }
    });

    // Sentiment distribution - normalize duplicates
    const sentimentDistribution: Record<string, number> = {};
    contacts.forEach((contact) => {
      let sentiment = contact.sentiment?.trim() || "";
      // Normalize common variations
      if (!sentiment) {
        sentiment = "Neutral";
      } else {
        // Remove "Sentiment:" prefix if present
        sentiment = sentiment.replace(/^Sentiment:\s*/i, "").trim() || "Neutral";
        // Normalize case
        const lowerSentiment = sentiment.toLowerCase();
        if (lowerSentiment.includes("positive")) {
          sentiment = sentiment.toLowerCase().includes("very") ? "Very Positive" : "Positive";
        } else if (lowerSentiment.includes("negative")) {
          sentiment = sentiment.toLowerCase().includes("very") ? "Very Negative" : "Negative";
        } else {
          sentiment = "Neutral";
        }
      }
      sentimentDistribution[sentiment] = (sentimentDistribution[sentiment] || 0) + 1;
    });

    // Engagement levels based on engagement score
    const engagementLevels = {
      high: contacts.filter((c) => (c.engagementScore || 0) >= 70).length,
      medium: contacts.filter((c) => {
        const score = c.engagementScore || 0;
        return score >= 40 && score < 70;
      }).length,
      low: contacts.filter((c) => {
        const score = c.engagementScore || 0;
        return score > 0 && score < 40;
      }).length,
      none: contacts.filter((c) => !c.engagementScore || c.engagementScore === 0).length,
    };

    // Upcoming touchpoints (contacts with nextTouchpointDate in the future)
    // Use server time for consistency
    const serverTime = new Date();
    const upcomingTouchpoints = contacts.filter((contact) => {
      if (!contact.nextTouchpointDate) return false;
      // Handle ISO string (from convertTimestamp) or Date
      let touchpointDate: Date | null = null;
      if (contact.nextTouchpointDate instanceof Date) {
        touchpointDate = contact.nextTouchpointDate;
      } else if (typeof contact.nextTouchpointDate === "string") {
        touchpointDate = new Date(contact.nextTouchpointDate);
      }
      return touchpointDate && touchpointDate > serverTime;
    }).length;

    return {
      totalContacts,
      contactsWithEmail,
      contactsWithThreads,
      averageEngagementScore: Math.round(averageEngagementScore * 10) / 10,
      segmentDistribution,
      leadSourceDistribution,
      tagDistribution,
      sentimentDistribution,
      engagementLevels,
      upcomingTouchpoints,
    };
  } catch (error) {
    reportException(error, {
      context: "Getting dashboard stats",
      tags: { component: "dashboard-stats-server", userId },
    });
    throw error;
  }
}

/**
 * Get dashboard statistics for a user
 * 
 * @param userId - The user ID
 * @returns Dashboard statistics calculated from all contacts
 * 
 * Note: Caching is handled by React Query on the client side
 */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  return getDashboardStatsUncached(userId);
}

