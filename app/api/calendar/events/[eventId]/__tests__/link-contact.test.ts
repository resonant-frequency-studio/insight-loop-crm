// Mock dependencies before importing route
jest.mock("@/lib/auth-utils");
jest.mock("@/lib/contacts-server");
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

import { POST } from "../link-contact/route";
import { adminDb } from "@/lib/firebase-admin";
import { getContactForUser } from "@/lib/contacts-server";
import { createMockDocSnapshot } from "@/lib/__mocks__/firebase-admin";
import { CalendarEvent, Contact } from "@/types/firestore";
import { getUserId } from "@/lib/auth-utils";

const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;
const mockGetContactForUser = getContactForUser as jest.MockedFunction<typeof getContactForUser>;

describe("POST /api/calendar/events/[eventId]/link-contact", () => {
  const mockUserId = "user123";
  const mockEventId = "event123";
  const mockContactId = "contact456";

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(mockUserId);
  });

  it("should successfully link event to contact", async () => {
    const mockEvent: CalendarEvent = {
      eventId: mockEventId,
      googleEventId: "google123",
      userId: mockUserId,
      title: "Test Event",
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockContact: Contact = {
      contactId: mockContactId,
      primaryEmail: "test@example.com",
      firstName: "Test",
      lastName: "User",
      segment: "VIP",
      tags: ["important"],
      engagementScore: 85,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Mock event document
    const updatedEvent = {
      ...mockEvent,
      matchedContactId: mockContactId,
      matchMethod: "manual",
      matchConfidence: "high",
      matchOverriddenByUser: true,
      contactSnapshot: {
        name: "Test User",
        segment: "VIP",
        tags: ["important"],
        primaryEmail: "test@example.com",
        engagementScore: 85,
        snapshotUpdatedAt: expect.anything(),
      },
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

    mockGetContactForUser.mockResolvedValue(mockContact);

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ contactId: mockContactId }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ eventId: mockEventId }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.event.matchedContactId).toBe(mockContactId);
    expect(data.event.matchMethod).toBe("manual");
    expect(data.event.matchConfidence).toBe("high");
    expect(data.event.matchOverriddenByUser).toBe(true);
    expect(data.event.contactSnapshot).toBeDefined();
    expect(data.event.contactSnapshot.name).toBe("Test User");
    expect(data.event.contactSnapshot.segment).toBe("VIP");
  });

  it("should return 400 if contactId is missing", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, {
      params: Promise.resolve({ eventId: mockEventId }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("contactId");
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
      body: JSON.stringify({ contactId: mockContactId }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ eventId: mockEventId }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Event not found");
  });

  it("should return 404 if contact not found", async () => {
    const mockEvent: CalendarEvent = {
      eventId: mockEventId,
      googleEventId: "google123",
      userId: mockUserId,
      title: "Test Event",
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockEventDocGet = jest.fn().mockResolvedValue(
      createMockDocSnapshot(mockEvent, mockEventId)
    );

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

    (getContactForUser as jest.Mock).mockResolvedValue(null);

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ contactId: mockContactId }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ eventId: mockEventId }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Contact not found");
  });
});

