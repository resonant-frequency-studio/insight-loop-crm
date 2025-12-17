import { syncTouchpointToCalendar, syncTouchpointStatusToCalendar } from "../sync-touchpoints";
import { adminDb } from "@/lib/firebase-admin";
import { Contact, CalendarEvent } from "@/types/firestore";
import { Timestamp, Firestore } from "firebase-admin/firestore";

// Mock Firebase Admin
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn(),
  },
}));

// Mock error reporting
jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
}));

describe("syncTouchpointToCalendar", () => {
  const mockUserId = "user123";
  const mockContactId = "contact123";
  
  const mockContact: Contact & { contactId: string } = {
    contactId: mockContactId,
    primaryEmail: "test@example.com",
    firstName: "John",
    lastName: "Doe",
    segment: "Prospect",
    tags: ["Lead"],
    engagementScore: 75,
    nextTouchpointDate: Timestamp.fromDate(new Date("2025-01-15T09:00:00Z")),
    nextTouchpointMessage: "Follow up on proposal",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create a new calendar event when touchpoint date is set", async () => {
    const mockEventsCollection = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [],
        empty: true,
      }),
      add: jest.fn().mockResolvedValue({
        id: "event123",
      }),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue(mockEventsCollection),
      }),
    };

    (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

    const result = await syncTouchpointToCalendar(
      adminDb as unknown as Firestore,
      mockUserId,
      mockContact
    );

    expect(result).toBe("event123");
    expect(mockEventsCollection.add).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserId,
        title: "Follow up: John Doe",
        description: "Follow up on proposal",
        sourceOfTruth: "crm_touchpoint",
        matchedContactId: mockContactId,
        matchMethod: "manual",
        matchConfidence: "high",
        contactSnapshot: expect.objectContaining({
          name: "John Doe",
          segment: "Prospect",
          tags: ["Lead"],
          primaryEmail: "test@example.com",
          engagementScore: 75,
        }),
      })
    );
  });

  it("should update existing calendar event when touchpoint date changes", async () => {
    const mockExistingEvent = {
      id: "event123",
      ref: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      data: jest.fn().mockReturnValue({
        createdAt: Timestamp.now(),
      }),
    };

    const mockEventsCollection = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [mockExistingEvent],
        empty: false,
      }),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue(mockEventsCollection),
      }),
    };

    (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

    const result = await syncTouchpointToCalendar(
      adminDb as unknown as Firestore,
      mockUserId,
      mockContact
    );

    expect(result).toBe("event123");
    expect(mockExistingEvent.ref.update).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserId,
        title: "Follow up: John Doe",
        description: "Follow up on proposal",
        sourceOfTruth: "crm_touchpoint",
        matchedContactId: mockContactId,
      })
    );
  });

  it("should delete calendar event when touchpoint date is cleared", async () => {
    const mockExistingEvent = {
      id: "event123",
      ref: {
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };

    const mockEventsCollection = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [mockExistingEvent],
        empty: false,
      }),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue(mockEventsCollection),
      }),
    };

    (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

    const contactWithoutTouchpoint = {
      ...mockContact,
      nextTouchpointDate: null,
    };

    const result = await syncTouchpointToCalendar(
      adminDb as unknown as Firestore,
      mockUserId,
      contactWithoutTouchpoint
    );

    expect(result).toBeNull();
    expect(mockExistingEvent.ref.delete).toHaveBeenCalled();
  });

  it("should handle contact without name (use email)", async () => {
    const mockEventsCollection = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [],
        empty: true,
      }),
      add: jest.fn().mockResolvedValue({
        id: "event123",
      }),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue(mockEventsCollection),
      }),
    };

    (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

    const contactWithoutName = {
      ...mockContact,
      firstName: null,
      lastName: null,
    };

    await syncTouchpointToCalendar(
      adminDb as unknown as Firestore,
      mockUserId,
      contactWithoutName
    );

    expect(mockEventsCollection.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Follow up: test@example.com",
        contactSnapshot: expect.objectContaining({
          name: "test@example.com",
        }),
      })
    );
  });

  it("should handle invalid touchpoint date gracefully", async () => {
    const mockAdd = jest.fn();
    const mockEventsCollection = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [],
        empty: true,
      }),
      add: mockAdd,
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue(mockEventsCollection),
      }),
    };

    (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

    const contactWithInvalidDate = {
      ...mockContact,
      nextTouchpointDate: "invalid-date" as unknown,
    };

    const result = await syncTouchpointToCalendar(
      adminDb as unknown as Firestore,
      mockUserId,
      contactWithInvalidDate
    );

    expect(result).toBeNull();
    expect(mockAdd).not.toHaveBeenCalled();
  });
});

describe("syncTouchpointStatusToCalendar", () => {
  const mockUserId = "user123";
  const mockContactId = "contact123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should update event title when status is completed", async () => {
    const mockExistingEvent = {
      id: "event123",
      ref: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      data: jest.fn().mockReturnValue({
        title: "Follow up: John Doe",
      } as CalendarEvent),
    };

    const mockEventsCollection = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [mockExistingEvent],
        empty: false,
      }),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue(mockEventsCollection),
      }),
    };

    (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

    await syncTouchpointStatusToCalendar(
      adminDb as unknown as Firestore,
      mockUserId,
      mockContactId,
      "completed"
    );

    expect(mockExistingEvent.ref.update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "✓ Follow up: John Doe",
      })
    );
  });

  it("should delete event when status is cancelled", async () => {
    const mockExistingEvent = {
      id: "event123",
      ref: {
        delete: jest.fn().mockResolvedValue(undefined),
      },
      data: jest.fn().mockReturnValue({
        title: "Follow up: John Doe",
      } as CalendarEvent),
    };

    const mockEventsCollection = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [mockExistingEvent],
        empty: false,
      }),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue(mockEventsCollection),
      }),
    };

    (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

    await syncTouchpointStatusToCalendar(
      adminDb as unknown as Firestore,
      mockUserId,
      mockContactId,
      "cancelled"
    );

    expect(mockExistingEvent.ref.delete).toHaveBeenCalled();
  });

  it("should do nothing when no touchpoint event exists", async () => {
    const mockEventsCollection = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [],
        empty: true,
      }),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue(mockEventsCollection),
      }),
    };

    (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

    await syncTouchpointStatusToCalendar(
      adminDb as unknown as Firestore,
      mockUserId,
      mockContactId,
      "completed"
    );

    // Should not throw and should not call any update/delete
    expect(mockEventsCollection.where).toHaveBeenCalled();
  });

  it("should handle errors gracefully without throwing", async () => {
    const mockEventsCollection = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockRejectedValue(new Error("Database error")),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue(mockEventsCollection),
      }),
    };

    (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

    // Should not throw
    await expect(
      syncTouchpointStatusToCalendar(
        adminDb as unknown as Firestore,
        mockUserId,
        mockContactId,
        "completed"
      )
    ).resolves.not.toThrow();
  });
});

