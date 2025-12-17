import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";
import { toUserFriendlyError } from "@/lib/error-utils";
import { getCalendarEventById } from "@/lib/calendar/get-calendar-event-by-id";
import { getContactForUser } from "@/lib/contacts-server";
import { getContactTimeline } from "@/lib/timeline/get-contact-timeline";
import { EVENT_CONTEXT_PROMPT } from "@/lib/gemini/event-context-prompt";
import { Contact } from "@/types/firestore";

interface EventContextResponse {
  summary: string;
  suggestedNextStep: string;
  suggestedTouchpointDate?: string; // ISO date string
  suggestedTouchpointRationale?: string;
  suggestedActionItems?: string[]; // Array of action item text
  followUpEmailDraft?: string;
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

    // Fetch linked contact and timeline data if available
    let contact: Contact | null = null;
    let contactName: string | null = null;
    let timelineItems: Array<{ type: string; title: string; timestamp: unknown; description?: string | null }> = [];
    let lastEmailThreadSummary: string | null = null;

    if (event.matchedContactId) {
      try {
        contact = await getContactForUser(userId, event.matchedContactId);
        if (contact) {
          contactName = contact.firstName || contact.lastName
            ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
            : contact.primaryEmail;

          // Fetch recent timeline items (last 10 items for context)
          try {
            const timeline = await getContactTimeline(adminDb, userId, event.matchedContactId, { limit: 10 });
            timelineItems = timeline.map(item => ({
              type: item.type,
              title: item.title,
              timestamp: item.timestamp,
              description: item.description,
            }));
          } catch (timelineError) {
            // Log but don't fail if timeline fetch fails
            reportException(timelineError, {
              context: "Fetching timeline for AI context",
              tags: { component: "ai-context-api", eventId, contactId: event.matchedContactId },
            });
          }

          // Fetch last email thread summary if available
          try {
            const threadsCollection = adminDb
              .collection("users")
              .doc(userId)
              .collection("threads");
            
            try {
              // Try query with index first
              const threadsSnapshot = await threadsCollection
                .where("contactId", "==", event.matchedContactId)
                .orderBy("lastMessageAt", "desc")
                .limit(1)
                .get();

              if (!threadsSnapshot.empty) {
                const lastThread = threadsSnapshot.docs[0].data();
                if (lastThread.summary) {
                  if (typeof lastThread.summary === "string") {
                    lastEmailThreadSummary = lastThread.summary;
                  } else if (typeof lastThread.summary === "object" && lastThread.summary !== null) {
                    // Handle ThreadSummary object format
                    const threadSummary = lastThread.summary as { summary?: string };
                    lastEmailThreadSummary = threadSummary.summary || null;
                  }
                }
              }
            } catch (queryError) {
              // Fallback: fetch all threads and filter in memory
              const errorMessage = queryError instanceof Error ? queryError.message : String(queryError);
              if (errorMessage.includes("index") || errorMessage.includes("requires an index")) {
                const allThreadsSnapshot = await threadsCollection.get();
                const filteredThreads = allThreadsSnapshot.docs.filter((doc) => {
                  const thread = doc.data();
                  const threadWithContactId = thread as { contactId?: string; contactIds?: string[] };
                  const contactId = event.matchedContactId;
                  if (!contactId) return false;
                  return (
                    threadWithContactId.contactId === contactId ||
                    threadWithContactId.contactIds?.includes(contactId)
                  );
                });

                if (filteredThreads.length > 0) {
                  // Sort by lastMessageAt and get the most recent
                  const sortedThreads = filteredThreads
                    .map((doc) => {
                      const thread = doc.data();
                      const lastMessageAt = thread.lastMessageAt instanceof Date
                        ? thread.lastMessageAt
                        : typeof thread.lastMessageAt === "string"
                        ? new Date(thread.lastMessageAt)
                        : null;
                      return { doc, lastMessageAt };
                    })
                    .filter((item) => item.lastMessageAt !== null)
                    .sort((a, b) => {
                      const aTime = a.lastMessageAt?.getTime() || 0;
                      const bTime = b.lastMessageAt?.getTime() || 0;
                      return bTime - aTime; // Descending
                    });

                  if (sortedThreads.length > 0) {
                    const lastThread = sortedThreads[0].doc.data();
                    if (lastThread.summary) {
                      if (typeof lastThread.summary === "string") {
                        lastEmailThreadSummary = lastThread.summary;
                      } else if (typeof lastThread.summary === "object" && lastThread.summary !== null) {
                        // Handle ThreadSummary object format
                        const threadSummary = lastThread.summary as { summary?: string };
                        lastEmailThreadSummary = threadSummary.summary || null;
                      }
                    }
                  }
                }
              } else {
                throw queryError;
              }
            }
          } catch (threadError) {
            // Log but don't fail if thread fetch fails
            reportException(threadError, {
              context: "Fetching email thread summary for AI context",
              tags: { component: "ai-context-api", eventId, contactId: event.matchedContactId },
            });
          }
        }
      } catch (error) {
        // Log but don't fail if contact fetch fails
        reportException(error, {
          context: "Fetching contact for AI context",
          tags: { component: "ai-context-api", eventId, contactId: event.matchedContactId },
        });
      }
    }

    // Build prompt with timeline data
    const prompt = EVENT_CONTEXT_PROMPT(
      event.title,
      event.description || null,
      event.attendees || [],
      contactName,
      contact,
      timelineItems,
      lastEmailThreadSummary
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
      suggestedTouchpointDate: parsed.suggestedTouchpointDate,
      suggestedTouchpointRationale: parsed.suggestedTouchpointRationale,
      suggestedActionItems: parsed.suggestedActionItems || [],
      followUpEmailDraft: parsed.followUpEmailDraft,
    });
  } catch (err) {
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

