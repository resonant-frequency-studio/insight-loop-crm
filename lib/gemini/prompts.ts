export const THREAD_SUMMARY_PROMPT = (transcript: string) => `
You are an AI executive-coaching assistant analyzing an email thread between a leadership coach and a client.

Summarize this email thread and return a JSON object with EXACTLY these fields:

{
  "summary": "",
  "actionItems": [],
  "sentiment": "",
  "relationshipInsights": "",
  "painPoints": [],
  "coachingThemes": [],
  "nextTouchpointDate": "",
  "nextTouchpointMessage": "",
  "outreachDraft": ""
}

Guidelines:
- Use concise, professional language.
- Extract *specific* action items.
- Identify emotional tone without exaggeration.
- Extract client challenges as "painPoints".
- Identify high-level coaching themes.
- Suggest a next touchpoint (date and short message).
- Provide a ready-to-send outreach draft.

Here is the email transcript:
${transcript}
`;
