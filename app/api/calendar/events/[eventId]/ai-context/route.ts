import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";
import { getCalendarEventById } from "@/lib/calendar/get-calendar-event-by-id";
import { getContactForUser } from "@/lib/contacts-server";
import { EVENT_CONTEXT_PROMPT } from "@/lib/gemini/event-context-prompt";

interface EventContextResponse {
  summary: string;
  suggestedNextStep: string;
}

/**
 * GET /api/calendar/events/[eventId]/ai-context
 * Generate AI context for a calendar event
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const userId = await getUserId();
    const { eventId } = await params;

    // Fetch event from Firestore
    const event = await getCalendarEventById(adminDb, userId, eventId);

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Fetch linked contact if available
    let contactName: string | null = null;
    if (event.matchedContactId) {
      try {
        const contact = await getContactForUser(userId, event.matchedContactId);
        if (contact) {
          contactName = contact.firstName || contact.lastName
            ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
            : contact.primaryEmail;
        }
      } catch (error) {
        // Log but don't fail if contact fetch fails
        reportException(error, {
          context: "Fetching contact for AI context",
          tags: { component: "ai-context-api", eventId, contactId: event.matchedContactId },
        });
      }
    }

    // Build prompt
    const prompt = EVENT_CONTEXT_PROMPT(
      event.title,
      event.description || null,
      event.attendees || [],
      contactName
    );

    // Call Gemini API
    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      reportException(new Error(`Gemini API error: ${errorText}`), {
        context: "AI context generation",
        tags: { component: "ai-context-api", eventId },
      });
      return NextResponse.json(
        { error: "Failed to generate AI context. Please try again." },
        { status: 500 }
      );
    }

    const geminiJson = await geminiResponse.json();
    let text = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Strip markdown code blocks if present (Gemini sometimes wraps JSON in ```json ... ```)
    text = text.trim();
    if (text.startsWith("```")) {
      // Remove opening ```json or ```
      text = text.replace(/^```(?:json)?\n?/, "");
      // Remove closing ```
      text = text.replace(/\n?```$/, "");
      text = text.trim();
    }

    // Parse JSON response
    let parsed: EventContextResponse;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      reportException(parseError, {
        context: "Parsing AI context response",
        tags: { component: "ai-context-api", eventId },
        extra: { responseText: text },
      });
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    // Validate response structure
    if (!parsed.summary || !parsed.suggestedNextStep) {
      return NextResponse.json(
        { error: "Invalid AI response format. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      summary: parsed.summary,
      suggestedNextStep: parsed.suggestedNextStep,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    reportException(err, {
      context: "Generating AI context for calendar event",
      tags: { component: "ai-context-api" },
    });

    const friendlyError = toUserFriendlyError(err);

    return NextResponse.json(
      {
        ok: false,
        error: friendlyError,
      },
      { status: 500 }
    );
  }
}

