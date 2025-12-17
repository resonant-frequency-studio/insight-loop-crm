// Mock dependencies before importing route
jest.mock("@/lib/auth-utils");
jest.mock("@/lib/firebase-admin", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockModule = require("@/lib/__mocks__/firebase-admin");
  return {
    adminDb: mockModule.adminDb,
  };
});
jest.mock("@/lib/calendar/get-calendar-event-by-id");
jest.mock("@/lib/contacts-server");
jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
}));
jest.mock("@/lib/error-utils", () => ({
  toUserFriendlyError: jest.fn((err) => err instanceof Error ? err.message : String(err)),
}));
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      json: async () => body,
      status: init?.status || 200,
      ok: (init?.status || 200) >= 200 && (init?.status || 200) < 300,
    })),
  },
}));

import { GET } from "../ai-context/route";
import { getUserId } from "@/lib/auth-utils";
import { getCalendarEventById } from "@/lib/calendar/get-calendar-event-by-id";
import { getContactForUser } from "@/lib/contacts-server";
import { CalendarEvent, Contact } from "@/types/firestore";
import { Timestamp } from "firebase-admin/firestore";

const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;
const mockGetCalendarEventById = getCalendarEventById as jest.MockedFunction<typeof getCalendarEventById>;
const mockGetContactForUser = getContactForUser as jest.MockedFunction<typeof getContactForUser>;

// Mock environment variable
const originalEnv = process.env;

describe("GET /api/calendar/events/[eventId]/ai-context", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, GOOGLE_API_KEY: "test-api-key" };
    mockGetUserId.mockResolvedValue(mockUserId);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const mockUserId = "user123";
  const mockEventId = "event123";

  const mockEvent: CalendarEvent = {
    eventId: mockEventId,
    googleEventId: "google123",
    userId: mockUserId,
    title: "Team Meeting",
    description: "Discuss Q1 goals",
    startTime: "2025-01-15T10:00:00Z",
    endTime: "2025-01-15T11:00:00Z",
    location: "Conference Room A",
    attendees: [
      { email: "john@example.com", displayName: "John Doe" },
      { email: "jane@example.com", displayName: "Jane Smith" },
    ],
    lastSyncedAt: "2025-01-15T09:00:00Z",
    createdAt: "2025-01-15T09:00:00Z",
    updatedAt: "2025-01-15T09:00:00Z",
    sourceOfTruth: "google",
  };

  const mockContact: Contact = {
    contactId: "contact123",
    primaryEmail: "john@example.com",
    firstName: "John",
    lastName: "Doe",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  it("should generate AI context successfully for event without linked contact", async () => {
    mockGetCalendarEventById.mockResolvedValue(mockEvent);

    // Mock Gemini API response
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: "• Team meeting to discuss Q1 goals\n• Key attendees: John Doe, Jane Smith\n• Focus on strategic planning",
                  suggestedNextStep: "Schedule follow-up meeting to review action items",
                }),
              },
            ],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse,
    });

    const request = new Request(`http://localhost/api/calendar/events/${mockEventId}/ai-context`);
    const response = await GET(request, { params: Promise.resolve({ eventId: mockEventId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.summary).toBeDefined();
    expect(data.suggestedNextStep).toBeDefined();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("gemini-2.5-pro:generateContent"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("should generate AI context successfully for event with linked contact", async () => {
    mockGetCalendarEventById.mockResolvedValue({
      ...mockEvent,
      matchedContactId: "contact123",
    });
    mockGetContactForUser.mockResolvedValue(mockContact);

    // Mock Gemini API response
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: "• Team meeting with John Doe to discuss Q1 goals\n• Key attendees: John Doe, Jane Smith\n• Focus on strategic planning",
                  suggestedNextStep: "Follow up with John Doe on action items",
                }),
              },
            ],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse,
    });

    const request = new Request(`http://localhost/api/calendar/events/${mockEventId}/ai-context`);
    const response = await GET(request, { params: Promise.resolve({ eventId: mockEventId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.summary).toBeDefined();
    expect(data.suggestedNextStep).toBeDefined();
    expect(getContactForUser).toHaveBeenCalledWith(mockUserId, "contact123");
  });

  it("should return 404 if event not found", async () => {
    mockGetCalendarEventById.mockResolvedValue(null);

    const request = new Request(`http://localhost/api/calendar/events/${mockEventId}/ai-context`);
    const response = await GET(request, { params: Promise.resolve({ eventId: mockEventId }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Event not found");
  });

  it("should handle Gemini API errors gracefully", async () => {
    mockGetCalendarEventById.mockResolvedValue(mockEvent);

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const request = new Request(`http://localhost/api/calendar/events/${mockEventId}/ai-context`);
    const response = await GET(request, { params: Promise.resolve({ eventId: mockEventId }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it("should handle invalid JSON response from Gemini", async () => {
    mockGetCalendarEventById.mockResolvedValue(mockEvent);

    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "Invalid JSON response",
              },
            ],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse,
    });

    const request = new Request(`http://localhost/api/calendar/events/${mockEventId}/ai-context`);
    const response = await GET(request, { params: Promise.resolve({ eventId: mockEventId }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it("should handle missing GOOGLE_API_KEY", async () => {
    process.env.GOOGLE_API_KEY = undefined;
    mockGetCalendarEventById.mockResolvedValue(mockEvent);

    const request = new Request(`http://localhost/api/calendar/events/${mockEventId}/ai-context`);
    const response = await GET(request, { params: Promise.resolve({ eventId: mockEventId }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("AI service not configured");
  });

  it("should handle contact fetch failure gracefully", async () => {
    mockGetCalendarEventById.mockResolvedValue({
      ...mockEvent,
      matchedContactId: "contact123",
    });
    mockGetContactForUser.mockRejectedValue(new Error("Contact not found"));

    // Mock Gemini API response
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: "• Team meeting to discuss Q1 goals",
                  suggestedNextStep: "Schedule follow-up meeting",
                }),
              },
            ],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse,
    });

    const request = new Request(`http://localhost/api/calendar/events/${mockEventId}/ai-context`);
    const response = await GET(request, { params: Promise.resolve({ eventId: mockEventId }) });
    const data = await response.json();

    // Should still succeed even if contact fetch fails
    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it("should handle invalid AI response structure", async () => {
    mockGetCalendarEventById.mockResolvedValue(mockEvent);

    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  // Missing required fields
                  summary: "Test summary",
                }),
              },
            ],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse,
    });

    const request = new Request(`http://localhost/api/calendar/events/${mockEventId}/ai-context`);
    const response = await GET(request, { params: Promise.resolve({ eventId: mockEventId }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});

