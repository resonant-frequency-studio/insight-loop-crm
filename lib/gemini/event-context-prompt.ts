import { Contact } from "@/types/firestore";

interface TimelineItem {
  type: string;
  title: string;
  timestamp: unknown;
  description?: string | null;
}

/**
 * Generate a prompt for AI event context generation with timeline data
 */
export function EVENT_CONTEXT_PROMPT(
  title: string,
  description: string | null,
  attendees: Array<{ email?: string; displayName?: string }>,
  contactName?: string | null,
  contact?: Contact | null,
  timelineItems?: TimelineItem[],
  lastEmailThreadSummary?: string | null
): string {
  const attendeeList = attendees
    .map((a) => a.displayName || a.email || "Unknown")
    .join(", ");

  const contactInfo = contactName ? `\nLinked Contact: ${contactName}` : "";

  // Build timeline context
  let timelineContext = "";
  if (timelineItems && timelineItems.length > 0) {
    const timelineText = timelineItems
      .slice(0, 10) // Last 10 items
      .map((item, idx) => {
        const dateStr = item.timestamp instanceof Date
          ? item.timestamp.toISOString().split("T")[0]
          : typeof item.timestamp === "string"
          ? item.timestamp.split("T")[0]
          : "Unknown date";
        return `${idx + 1}. [${item.type}] ${item.title} (${dateStr})${item.description ? `: ${item.description.substring(0, 100)}` : ""}`;
      })
      .join("\n");
    timelineContext = `\n\nRecent Relationship Timeline (most recent first):\n${timelineText}`;
  }

  // Build contact context
  let contactContext = "";
  if (contact) {
    const contactDetails: string[] = [];
    if (contact.segment) contactDetails.push(`Segment: ${contact.segment}`);
    if (contact.tags && contact.tags.length > 0) contactDetails.push(`Tags: ${contact.tags.join(", ")}`);
    if (contact.engagementScore !== null && contact.engagementScore !== undefined) {
      contactDetails.push(`Engagement Score: ${contact.engagementScore}`);
    }
    if (contact.relationshipInsights) contactDetails.push(`Relationship Insights: ${contact.relationshipInsights}`);
    if (contact.painPoints) contactDetails.push(`Pain Points: ${contact.painPoints}`);
    if (contact.coachingThemes) contactDetails.push(`Coaching Themes: ${contact.coachingThemes}`);
    
    if (contactDetails.length > 0) {
      contactContext = `\n\nContact Context:\n${contactDetails.join("\n")}`;
    }
  }

  // Build email thread context
  let emailContext = "";
  if (lastEmailThreadSummary) {
    emailContext = `\n\nLast Email Thread Summary:\n${lastEmailThreadSummary.substring(0, 500)}${lastEmailThreadSummary.length > 500 ? "..." : ""}`;
  }

  return `You are an AI executive-coaching assistant analyzing a calendar event.

Analyze this calendar event in the context of the relationship history and provide actionable insights.

Return a JSON object with EXACTLY these fields:

{
  "summary": "A brief 3-5 bullet point summary of the event purpose, key attendees, and context. Ground this in the relationship timeline if available.",
  "suggestedNextStep": "One actionable next step or follow-up suggestion based on the event and relationship history.",
  "suggestedTouchpointDate": "ISO date string (YYYY-MM-DD) for the next touchpoint, or null if not applicable. Consider the event date, relationship cadence, and timeline patterns.",
  "suggestedTouchpointRationale": "Brief explanation (1-2 sentences) for why this touchpoint date was suggested, or null.",
  "suggestedActionItems": ["Action item 1", "Action item 2", ...] or empty array [],
  "followUpEmailDraft": "A draft follow-up email message (2-3 paragraphs) that can be sent after this event, or null if not applicable."
}

Guidelines:
- Use concise, professional language.
- Focus on the event's purpose and relevance to relationship management.
- Ground insights in the relationship timeline when available.
- Consider the contact's segment, engagement score, and relationship insights.
- Provide practical, actionable next steps and action items.
- Suggested touchpoint date should be realistic (typically 1-4 weeks after event, or sooner if urgent).
- Follow-up email should be warm, professional, and reference the event naturally.
- Keep summary to 3-5 bullet points maximum.
- Action items should be specific and actionable (2-4 items recommended).

Event Details:
Title: ${title}
${description ? `Description: ${description}` : ""}
Attendees: ${attendeeList || "None"}${contactInfo}${contactContext}${timelineContext}${emailContext}

Return only valid JSON, no additional text.`;
}

