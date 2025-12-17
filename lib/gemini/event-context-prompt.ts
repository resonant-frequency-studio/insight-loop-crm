/**
 * Generate a prompt for AI event context generation
 */
export function EVENT_CONTEXT_PROMPT(
  title: string,
  description: string | null,
  attendees: Array<{ email?: string; displayName?: string }>,
  contactName?: string | null
): string {
  const attendeeList = attendees
    .map((a) => a.displayName || a.email || "Unknown")
    .join(", ");

  const contactInfo = contactName ? `\nLinked Contact: ${contactName}` : "";

  return `You are an AI executive-coaching assistant analyzing a calendar event.

Summarize this calendar event and return a JSON object with EXACTLY these fields:

{
  "summary": "A brief 3-4 bullet point summary of the event purpose, key attendees, and context.",
  "suggestedNextStep": "One actionable next step or follow-up suggestion based on the event."
}

Guidelines:
- Use concise, professional language.
- Focus on the event's purpose and relevance to relationship management.
- If a contact is linked, consider their relationship context.
- Provide practical, actionable next steps.
- Keep summary to 3-4 bullet points maximum.

Event Details:
Title: ${title}
${description ? `Description: ${description}` : ""}
Attendees: ${attendeeList || "None"}${contactInfo}

Return only valid JSON, no additional text.`;
}

