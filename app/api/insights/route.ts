import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { getAllContactsForUserUncached } from "@/lib/contacts-server";
import { reportException } from "@/lib/error-reporting";
import { AiInsight } from "@/hooks/useAiInsights";

/**
 * Helper function to safely get date
 */
function getDate(date: unknown): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;
  if (typeof date === "string") return new Date(date);
  if (typeof date === "object" && "toDate" in date) {
    return (date as { toDate: () => Date }).toDate();
  }
  return null;
}

/**
 * GET /api/insights
 * Get rule-based AI insights for the authenticated user
 */
export async function GET() {
  try {
    const userId = await getUserId();
    // Use uncached version to avoid Next.js cache size limit (2MB)
    // Insights need fresh data anyway, so caching isn't critical here
    const contacts = await getAllContactsForUserUncached(userId);
    const serverTime = new Date();
    const insights: AiInsight[] = [];

    // Rule 1: Contact replied within last 48h → "Hot: consider following up with X"
    const recentReplies = contacts.filter((contact) => {
      if (!contact.lastEmailDate) return false;
      const lastEmailDate = getDate(contact.lastEmailDate);
      if (!lastEmailDate) return false;
      const hoursSinceReply = (serverTime.getTime() - lastEmailDate.getTime()) / (1000 * 60 * 60);
      return hoursSinceReply <= 48 && hoursSinceReply >= 0;
    });

    if (recentReplies.length > 0) {
      const topReply = recentReplies[0];
      const name = [topReply.firstName, topReply.lastName].filter(Boolean).join(" ") || topReply.primaryEmail;
      insights.push({
        id: "hot_followup",
        type: "hot_contact",
        title: `${recentReplies.length} contact${recentReplies.length !== 1 ? "s" : ""} replied recently`,
        description: `Consider following up with ${name}${recentReplies.length > 1 ? ` and ${recentReplies.length - 1} other${recentReplies.length > 2 ? "s" : ""}` : ""}.`,
        actionHref: `/contacts/${topReply.contactId}`,
      });
    }

    // Rule 2: No reply in 14+ days → "At-Risk: may require check-in"
    const atRiskContacts = contacts.filter((contact) => {
      if (contact.archived) return false;
      if (!contact.lastEmailDate) return true; // No email history is at-risk
      const lastEmailDate = getDate(contact.lastEmailDate);
      if (!lastEmailDate) return true;
      const daysSinceReply = (serverTime.getTime() - lastEmailDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceReply >= 14;
    });

    if (atRiskContacts.length > 0) {
      insights.push({
        id: "at_risk_contacts",
        type: "at_risk_contact",
        title: `${atRiskContacts.length} contact${atRiskContacts.length !== 1 ? "s" : ""} haven't replied in 14+ days`,
        description: "These contacts may be losing engagement and require a check-in.",
        actionHref: "/contacts?filter=at-risk",
      });
    }

    // Rule 3: Engagement score rises 20% → "Warm lead: opportunity to reach out"
    // Note: This would require tracking historical engagement scores, which we don't have
    // For now, we'll use high engagement score as a proxy
    const warmLeads = contacts.filter((contact) => {
      if (contact.archived) return false;
      const score = contact.engagementScore || 0;
      return score >= 50 && score < 70; // Medium-high engagement
    });

    if (warmLeads.length > 0) {
      insights.push({
        id: "warm_leads",
        type: "warm_lead",
        title: `${warmLeads.length} warm lead${warmLeads.length !== 1 ? "s" : ""} with rising engagement`,
        description: "These contacts show good engagement - opportunity to reach out and move the relationship forward.",
        actionHref: "/contacts?filter=warm",
      });
    }

    // Rule 4: Overdue > 10 items → "Your follow-up workload is accumulating"
    const overdueTouchpoints = contacts.filter((contact) => {
      if (contact.archived) return false;
      const touchpointDate = getDate(contact.nextTouchpointDate);
      if (!touchpointDate) return false;
      const status = contact.touchpointStatus;
      if (status === "completed" || status === "cancelled") return false;
      return touchpointDate < serverTime;
    });

    if (overdueTouchpoints.length > 10) {
      insights.push({
        id: "overdue_workload",
        type: "workload",
        title: `${overdueTouchpoints.length} overdue touchpoints`,
        description: "Your follow-up workload is accumulating. Consider prioritizing the most urgent items.",
        actionHref: "/touchpoints/overdue",
      });
    }

    // Rule 5: 2+ active clients no touchpoint in 30 days → "Schedule a check-in"
    const clientsNeedingCheckIn = contacts.filter((contact) => {
      if (contact.archived) return false;
      if (contact.segment?.toLowerCase().includes("client") || contact.segment?.toLowerCase().includes("active")) {
        const lastTouchpoint = contact.touchpointStatusUpdatedAt
          ? getDate(contact.touchpointStatusUpdatedAt)
          : null;
        if (!lastTouchpoint) return true; // Never had a touchpoint
        const daysSinceTouchpoint = (serverTime.getTime() - lastTouchpoint.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceTouchpoint >= 30;
      }
      return false;
    });

    if (clientsNeedingCheckIn.length >= 2) {
      insights.push({
        id: "client_checkin",
        type: "client_engagement",
        title: `${clientsNeedingCheckIn.length} active client${clientsNeedingCheckIn.length !== 1 ? "s" : ""} need a check-in`,
        description: "These clients haven't had a touchpoint in 30+ days. Schedule a check-in to maintain the relationship.",
        actionHref: "/contacts?segment=active-client",
      });
    }

    // Return top 3 insights
    return NextResponse.json({ insights: insights.slice(0, 3) });
  } catch (error) {
    reportException(error, {
      context: "Fetching AI insights",
      tags: { component: "insights-api" },
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

