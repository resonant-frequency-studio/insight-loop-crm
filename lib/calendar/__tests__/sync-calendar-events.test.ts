import { syncCalendarEventsToFirestore } from "../sync-calendar-events";
import { GoogleCalendarEvent } from "../get-calendar-events";
import { adminDb } from "@/lib/firebase-admin";
import type { Firestore } from "firebase-admin/firestore";

// Mock firebase-admin
jest.mock("@/lib/firebase-admin", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockModule = require("@/lib/__mocks__/firebase-admin");
  return {
    adminDb: mockModule.adminDb,
  };
});

// Mock error reporting
jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
}));

describe("syncCalendarEventsToFirestore", () => {
  const mockUserId = "user123";
  const mockDb = adminDb;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should populate all new schema fields when syncing events", async () => {
    const mockGoogleEvent: GoogleCalendarEvent = {
      id: "event123",
      summary: "Test Event",
      description: "Test description",
      location: "Test Location",
      etag: '"etag123"',
      updated: "2025-01-15T10:30:00Z",
      start: {
        dateTime: "2025-01-15T14:00:00Z",
      },
      end: {
        dateTime: "2025-01-15T15:00:00Z",
      },
      attendees: [
        { email: "attendee@example.com", displayName: "Attendee Name" },
      ],
    };

    // Mock nested collection structure: users/{userId}/calendarEvents/{eventId}
    const mockEventDocSet = jest.fn().mockResolvedValue(undefined);
    const mockEventDocGet = jest.fn().mockResolvedValue({
      exists: false,
      data: () => null,
    });
    const mockEventDoc = jest.fn().mockReturnValue({ 
      set: mockEventDocSet,
      get: mockEventDocGet,
      delete: jest.fn(),
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

    (mockDb.collection as jest.Mock) = jest.fn((path: string) => {
      if (path === "users") {
        return mockUsersCollection();
      }
      return mockEventsCollection();
    });

    const result = await syncCalendarEventsToFirestore(
      mockDb as unknown as Firestore,
      mockUserId,
      [mockGoogleEvent]
    );

    expect(result.synced).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(mockEventDocSet).toHaveBeenCalledTimes(1);

    const eventData = mockEventDocSet.mock.calls[0][0];
    
    // Verify all new fields are populated
    expect(eventData.googleEventId).toBe("event123");
    expect(eventData.etag).toBe('"etag123"');
    expect(eventData.sourceOfTruth).toBe("google");
    expect(eventData.isDirty).toBe(false);
    expect(eventData.googleUpdated).toBeDefined();
    expect(eventData.lastSyncedAt).toBeDefined();
  });

  it("should handle events without updated field", async () => {
    const mockGoogleEvent: GoogleCalendarEvent = {
      id: "event456",
      summary: "Event Without Updated",
      etag: '"etag456"',
      start: {
        dateTime: "2025-01-15T14:00:00Z",
      },
      end: {
        dateTime: "2025-01-15T15:00:00Z",
      },
    };

    const mockEventDocSet = jest.fn().mockResolvedValue(undefined);
    const mockEventDocGet = jest.fn().mockResolvedValue({
      exists: false,
      data: () => null,
    });
    const mockEventDoc = jest.fn().mockReturnValue({ 
      set: mockEventDocSet,
      get: mockEventDocGet,
      delete: jest.fn(),
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

    (mockDb.collection as jest.Mock) = jest.fn((path: string) => {
      if (path === "users") {
        return mockUsersCollection();
      }
      return mockEventsCollection();
    });

    const result = await syncCalendarEventsToFirestore(
      mockDb as unknown as Firestore,
      mockUserId,
      [mockGoogleEvent]
    );

    expect(result.synced).toBe(1);
    const eventData = mockEventDocSet.mock.calls[0][0];
    
    // Should still have googleUpdated (fallback to serverTimestamp)
    expect(eventData.googleUpdated).toBeDefined();
    expect(eventData.sourceOfTruth).toBe("google");
    expect(eventData.isDirty).toBe(false);
  });

  it("should skip cancelled events", async () => {
    const mockGoogleEvent: GoogleCalendarEvent = {
      id: "cancelled123",
      summary: "Cancelled Event",
      status: "cancelled",
      etag: '"etag789"',
      start: {
        dateTime: "2025-01-15T14:00:00Z",
      },
      end: {
        dateTime: "2025-01-15T15:00:00Z",
      },
    };

    const mockEventDocDelete = jest.fn().mockResolvedValue(undefined);
    const mockEventDocSet = jest.fn().mockResolvedValue(undefined);
    const mockEventDocGet = jest.fn().mockResolvedValue({
      exists: false,
      data: () => null,
    });
    const mockEventDoc = jest.fn().mockReturnValue({ 
      set: mockEventDocSet,
      get: mockEventDocGet,
      delete: mockEventDocDelete,
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

    (mockDb.collection as jest.Mock) = jest.fn((path: string) => {
      if (path === "users") {
        return mockUsersCollection();
      }
      return mockEventsCollection();
    });

    const result = await syncCalendarEventsToFirestore(
      mockDb as unknown as Firestore,
      mockUserId,
      [mockGoogleEvent]
    );

    expect(result.synced).toBe(0);
    expect(mockEventDocDelete).toHaveBeenCalledTimes(1);
    expect(mockEventDocSet).not.toHaveBeenCalled();
  });

  it("should handle all-day events correctly", async () => {
    const mockGoogleEvent: GoogleCalendarEvent = {
      id: "allday123",
      summary: "All Day Event",
      etag: '"etag_allday"',
      updated: "2025-01-15T10:30:00Z",
      start: {
        date: "2025-01-15",
      },
      end: {
        date: "2025-01-16", // Exclusive end date
      },
    };

    const mockEventDocSet = jest.fn().mockResolvedValue(undefined);
    const mockEventDocGet = jest.fn().mockResolvedValue({
      exists: false,
      data: () => null,
    });
    const mockEventDoc = jest.fn().mockReturnValue({ 
      set: mockEventDocSet,
      get: mockEventDocGet,
      delete: jest.fn(),
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

    (mockDb.collection as jest.Mock) = jest.fn((path: string) => {
      if (path === "users") {
        return mockUsersCollection();
      }
      return mockEventsCollection();
    });

    const result = await syncCalendarEventsToFirestore(
      mockDb as unknown as Firestore,
      mockUserId,
      [mockGoogleEvent]
    );

    expect(result.synced).toBe(1);
    const eventData = mockEventDocSet.mock.calls[0][0];
    
    // Verify all fields are set
    expect(eventData.googleEventId).toBe("allday123");
    expect(eventData.sourceOfTruth).toBe("google");
    expect(eventData.isDirty).toBe(false);
    expect(eventData.googleUpdated).toBeDefined();
  });

  it("should handle multiple events and report errors", async () => {
    const mockEvents: GoogleCalendarEvent[] = [
      {
        id: "event1",
        summary: "Event 1",
        etag: '"etag1"',
        updated: "2025-01-15T10:00:00Z",
        start: { dateTime: "2025-01-15T14:00:00Z" },
        end: { dateTime: "2025-01-15T15:00:00Z" },
      },
      {
        id: "event2",
        summary: "Event 2",
        etag: '"etag2"',
        updated: "2025-01-15T11:00:00Z",
        start: { dateTime: "2025-01-16T14:00:00Z" },
        end: { dateTime: "2025-01-16T15:00:00Z" },
      },
    ];

    const mockEventDocSet = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Sync failed"));

    const mockEventDocGet = jest.fn().mockResolvedValue({
      exists: false,
      data: () => null,
    });
    const mockEventDoc = jest.fn().mockReturnValue({ 
      set: mockEventDocSet,
      get: mockEventDocGet,
      delete: jest.fn(),
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

    (mockDb.collection as jest.Mock) = jest.fn((path: string) => {
      if (path === "users") {
        return mockUsersCollection();
      }
      return mockEventsCollection();
    });

    const result = await syncCalendarEventsToFirestore(
      mockDb as unknown as Firestore,
      mockUserId,
      mockEvents
    );

    expect(result.synced).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("event2");
  });
});

