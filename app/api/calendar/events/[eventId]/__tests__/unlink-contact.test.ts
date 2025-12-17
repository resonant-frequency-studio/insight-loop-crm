// Mock dependencies before importing route
jest.mock("@/lib/auth-utils");
jest.mock("@/lib/firebase-admin", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockModule = require("@/lib/__mocks__/firebase-admin");
  return {
    adminDb: mockModule.adminDb,
  };
});
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

import { POST } from "../unlink-contact/route";
import { adminDb } from "@/lib/firebase-admin";
import { createMockDocSnapshot } from "@/lib/__mocks__/firebase-admin";
import { CalendarEvent } from "@/types/firestore";
import { getUserId } from "@/lib/auth-utils";

const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;

describe("POST /api/calendar/events/[eventId]/unlink-contact", () => {
  const mockUserId = "user123";
  const mockEventId = "event123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(mockUserId);
  });

  it("should successfully unlink event from contact", async () => {
    const mockEvent: CalendarEvent = {
      eventId: mockEventId,
      googleEventId: "google123",
      userId: mockUserId,
      title: "Test Event",
      matchedContactId: "contact456",
      matchMethod: "manual",
      matchConfidence: "high",
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Mock event document
    const updatedEvent = {
      ...mockEvent,
      matchedContactId: null,
      matchOverriddenByUser: true,
      contactSnapshot: null,
    };
    const mockEventDocGet = jest.fn()
      .mockResolvedValueOnce(createMockDocSnapshot(mockEvent, mockEventId)) // Initial get
      .mockResolvedValueOnce(createMockDocSnapshot(updatedEvent, mockEventId)); // After update

    const mockEventDocUpdate = jest.fn().mockResolvedValue(undefined);
    const mockEventDoc = jest.fn().mockReturnValue({
      get: mockEventDocGet,
      update: mockEventDocUpdate,
    });

    const mockEventsCollection = jest.fn().mockReturnValue({
      doc: mockEventDoc,
    });

    const mockUserDoc = jest.fn().mockReturnValue({
      collection: mockEventsCollection,
    });

    const mockUsersCollection = jest.fn().mockReturnValue({
      doc: mockUserDoc,
    });

    (adminDb.collection as jest.Mock) = jest.fn((path: string) => {
      if (path === "users") {
        return mockUsersCollection();
      }
      return mockEventsCollection();
    });

    const request = new Request("http://localhost", {
      method: "POST",
    });

    const response = await POST(request, {
      params: Promise.resolve({ eventId: mockEventId }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.event.matchedContactId).toBeNull();
    expect(data.event.matchOverriddenByUser).toBe(true);
    expect(data.event.contactSnapshot).toBeNull();
    expect(mockEventDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        matchedContactId: null,
        matchOverriddenByUser: true,
        contactSnapshot: null,
      })
    );
  });

  it("should return 404 if event not found", async () => {
    const mockEventDocGet = jest.fn().mockResolvedValue({
      exists: false,
      data: () => null,
    });

    const mockEventDoc = jest.fn().mockReturnValue({
      get: mockEventDocGet,
    });

    const mockEventsCollection = jest.fn().mockReturnValue({
      doc: mockEventDoc,
    });

    const mockUserDoc = jest.fn().mockReturnValue({
      collection: mockEventsCollection,
    });

    const mockUsersCollection = jest.fn().mockReturnValue({
      doc: mockUserDoc,
    });

    (adminDb.collection as jest.Mock) = jest.fn((path: string) => {
      if (path === "users") {
        return mockUsersCollection();
      }
      return mockEventsCollection();
    });

    const request = new Request("http://localhost", {
      method: "POST",
    });

    const response = await POST(request, {
      params: Promise.resolve({ eventId: mockEventId }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Event not found");
  });
});

