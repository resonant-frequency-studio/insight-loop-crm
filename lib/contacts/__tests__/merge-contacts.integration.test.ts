// Mock dependencies before importing
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn(),
    collectionGroup: jest.fn(),
    runTransaction: jest.fn(),
  },
}));
jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
  ErrorLevel: {
    ERROR: "error",
    WARNING: "warning",
    INFO: "info",
  },
}));

import { mergeContacts } from "../merge-contacts";
import { adminDb } from "@/lib/firebase-admin";
import { Contact, ActionItem, Thread, CalendarEvent } from "@/types/firestore";
import { Timestamp } from "firebase-admin/firestore";

const mockAdminDb = adminDb as jest.Mocked<typeof adminDb>;

describe("mergeContacts Integration Tests", () => {
  const mockUserId = "user123";
  const mockPrimaryContactId = "contact1";
  const mockContactIdsToMerge = ["contact2"];
  const mockPrimaryEmail = "primary@example.com";

  const createMockContact = (overrides: Partial<Contact> = {}): Contact => ({
    contactId: "contact1",
    primaryEmail: "primary@example.com",
    firstName: "John",
    lastName: "Doe",
    createdAt: Timestamp.fromDate(new Date("2024-01-01")),
    updatedAt: Timestamp.fromDate(new Date("2024-01-01")),
    ...overrides,
  });

  // Helper to create proper Firebase admin mocks for nested collection structure
  const createFirebaseMocks = (contacts: Map<string, Contact>) => {
    const createMockDoc = (contactId: string) => {
      const contact = contacts.get(contactId);
      if (!contact) {
        return {
          exists: false,
          data: () => undefined,
        };
      }
      return {
        exists: true,
        data: () => contact,
      };
    };

    // Mock for subcollections (actionItems, etc.)
    const mockSubcollection = {
      get: jest.fn().mockResolvedValue({ docs: [] }),
      doc: jest.fn().mockReturnValue({
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
    };

    // Mock for threads collection (needs .get())
    const mockThreadsCollection = {
      get: jest.fn().mockResolvedValue({ docs: [] }),
    };

    // Mock for calendarEvents collection (needs .where().get())
    const mockCalendarEventsCollection = {
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ docs: [] }),
      }),
    };

    const mockContactsCollection = {
      doc: jest.fn((contactId: string) => ({
        get: jest.fn().mockResolvedValue(createMockDoc(contactId)),
        collection: jest.fn((subcollection: string) => {
          if (subcollection === "threads") {
            return mockThreadsCollection;
          }
          if (subcollection === "calendarEvents") {
            return mockCalendarEventsCollection;
          }
          return mockSubcollection;
        }),
      })),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    };

    const mockUserDoc = {
      collection: jest.fn((path: string) => {
        if (path === "contacts") {
          return mockContactsCollection;
        }
        if (path === "threads") {
          return mockThreadsCollection;
        }
        if (path === "calendarEvents") {
          return mockCalendarEventsCollection;
        }
        return mockSubcollection;
      }),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue(mockUserDoc),
    };

    // Handle both "users" and full paths like "users/userId/contacts/contactId/actionItems"
    const mockCollection = jest.fn((path: string) => {
      if (path === "users") {
        return mockUsersCollection;
      }
      // Handle full path strings (e.g., "users/userId/contacts/contactId/actionItems")
      if (path.includes("/")) {
        return mockSubcollection;
      }
      return mockContactsCollection;
    });

    return {
      collection: mockCollection,
      collectionGroup: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ docs: [] }),
        }),
      }),
      runTransaction: jest.fn().mockImplementation(async (callback) => {
        const mockTransaction = {
          update: jest.fn(),
          delete: jest.fn(),
          set: jest.fn(),
          get: jest.fn().mockResolvedValue({ exists: true, data: () => contacts.get(mockPrimaryContactId) }),
        };
        return callback(mockTransaction);
      }),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should perform end-to-end merge with action items, threads, and calendar events", async () => {
    const mockPrimaryContact = createMockContact({
      contactId: mockPrimaryContactId,
      primaryEmail: mockPrimaryEmail,
      threadCount: 5,
    });
    const mockContact2 = createMockContact({
      contactId: "contact2",
      primaryEmail: "contact2@example.com",
      threadCount: 3,
    });

    // Create contacts map
    const contactsMap = new Map<string, Contact>();
    contactsMap.set(mockPrimaryContactId, mockPrimaryContact);
    contactsMap.set("contact2", mockContact2);

    // Create base mocks
    const baseMocks = createFirebaseMocks(contactsMap);

    // Mock action items from merged contact
    const mockActionItem: ActionItem = {
      actionItemId: "action1",
      contactId: "contact2",
      userId: mockUserId,
      text: "Test action item",
      status: "pending",
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    };

    const mockActionItemsSnapshot = {
      docs: [
        {
          id: "action1",
          ref: {
            path: `users/${mockUserId}/contacts/contact2/actionItems/action1`,
            update: jest.fn(),
          },
          data: () => mockActionItem,
        },
      ],
    };

    // Mock threads
    const mockThread: Thread = {
      threadId: "thread1",
      gmailThreadId: "gmail1",
      contactIds: ["contact2"],
      firstMessageAt: Timestamp.fromDate(new Date()),
      lastMessageAt: Timestamp.fromDate(new Date()),
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    };

    const mockThreadsSnapshot = {
      docs: [
        {
          id: "thread1",
          ref: { 
            path: `users/${mockUserId}/threads/thread1`,
            update: jest.fn(),
          },
          data: () => mockThread,
        },
      ],
    };

    const mockThreadsCollection = {
      get: jest.fn().mockResolvedValue(mockThreadsSnapshot),
    };

    // Mock calendar events
    const mockCalendarEvent: CalendarEvent = {
      eventId: "event1",
      googleEventId: "google1",
      userId: mockUserId,
      title: "Meeting",
      startTime: Timestamp.fromDate(new Date()),
      endTime: Timestamp.fromDate(new Date()),
      matchedContactId: "contact2",
      lastSyncedAt: Timestamp.fromDate(new Date()),
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    };

    const mockEventsCollection = {
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          docs: [
            {
              id: "event1",
              ref: { 
                path: `users/${mockUserId}/calendarEvents/event1`,
                update: jest.fn(),
              },
              data: () => mockCalendarEvent,
            },
          ],
        }),
      }),
    };

    // Mock action items subcollection for moving (used by actionItemsPath)
    const mockActionItemsCollection = {
      get: jest.fn().mockResolvedValue({
        docs: [
          {
            id: "action1",
            ref: {
              path: `users/${mockUserId}/contacts/contact2/actionItems/action1`,
              update: jest.fn(),
              delete: jest.fn(),
            },
            data: () => mockActionItem,
          },
        ],
      }),
      doc: jest.fn().mockReturnValue({
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
    };

    // Update baseMocks to return the specific collections with data
    // Override the threads collection in the userDoc mock
    const originalUserDocCollection = baseMocks.collection.mock.results[0]?.value?.doc?.mock?.results[0]?.value?.collection;
    if (originalUserDocCollection) {
      originalUserDocCollection.mockImplementation((path: string) => {
        if (path === "threads") {
          return mockThreadsCollection;
        }
        if (path === "calendarEvents") {
          return mockEventsCollection;
        }
        return originalUserDocCollection(path);
      });
    }

    // Override the mocks to return data
    // Get the userDoc from baseMocks BEFORE overriding collection
    const mockUsersCollection = baseMocks.collection("users");
    const mockUserDoc = mockUsersCollection.doc(mockUserId);
    
    // Get the contacts collection BEFORE overriding (to avoid circular reference)
    const contactsCollection = mockUserDoc.collection("contacts");
    
    // Override contactsCollection.doc() to return docs with actionItems subcollection
    const originalContactsDoc = contactsCollection.doc;
    contactsCollection.doc = jest.fn((contactId: string) => {
      const originalDoc = originalContactsDoc(contactId);
      const originalDocCollection = originalDoc.collection;
      originalDoc.collection = jest.fn((subcollection: string) => {
        if (subcollection === "actionItems") {
          return mockActionItemsCollection;
        }
        return originalDocCollection(subcollection);
      });
      return originalDoc;
    });
    
    // Override collection method on userDoc to return threads and calendarEvents with data
    mockUserDoc.collection = jest.fn((path: string) => {
      if (path === "threads") {
        return mockThreadsCollection;
      }
      if (path === "calendarEvents") {
        return mockEventsCollection;
      }
      if (path === "contacts") {
        return contactsCollection;
      }
      // For other subcollections, return empty subcollection
      return {
        get: jest.fn().mockResolvedValue({ docs: [] }),
      };
    });

    // Override collection to handle actionItems paths (full path strings)
    const originalCollection = baseMocks.collection;
    baseMocks.collection = jest.fn((path: string) => {
      if (path.includes("actionItems")) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test mock doesn't match full Firebase SDK types
        return mockActionItemsCollection as any;
      }
      return originalCollection(path);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test mock doesn't match full Firebase SDK types
    }) as any;

    // Override collectionGroup to return action items
    baseMocks.collectionGroup = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(mockActionItemsSnapshot),
      }),
    });

    // Override transaction to track calls
    const mockTransaction = {
      update: jest.fn(),
      delete: jest.fn(),
      set: jest.fn(),
    };
    baseMocks.runTransaction = jest.fn().mockImplementation(async (callback) => {
      return callback(mockTransaction);
    });

    // Apply all mocks to adminDb
    Object.assign(mockAdminDb, baseMocks);

    const result = await mergeContacts(
      mockUserId,
      mockPrimaryContactId,
      mockContactIdsToMerge,
      mockPrimaryEmail
    );

    if (!result.success) {
      console.error("Merge failed:", result.error);
    }

    expect(result.success).toBe(true);
    expect(result.statistics.actionItemsUpdated).toBeGreaterThan(0);
    expect(result.statistics.threadsUpdated).toBeGreaterThan(0);
    expect(result.statistics.calendarEventsUpdated).toBeGreaterThan(0);
    expect(result.statistics.actionItemsMoved).toBeGreaterThan(0);

    // Verify transaction was called
    expect(mockAdminDb.runTransaction).toHaveBeenCalled();

    // Verify updates were made
    expect(mockTransaction.update).toHaveBeenCalled();
    expect(mockTransaction.delete).toHaveBeenCalled();
  });

  it("should handle transaction rollback on error", async () => {
    const mockPrimaryContact = createMockContact({
      contactId: mockPrimaryContactId,
      primaryEmail: mockPrimaryEmail,
    });
    const mockContact2 = createMockContact({
      contactId: "contact2",
      primaryEmail: "contact2@example.com",
    });

    const mockDoc = {
      exists: true,
      data: jest.fn(),
    };
    const mockCollection = {
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(mockDoc),
      }),
    };

    mockAdminDb.collection = jest.fn().mockReturnValue(mockCollection);
    mockDoc.data
      .mockReturnValueOnce(mockPrimaryContact)
      .mockReturnValueOnce(mockContact2);

    mockAdminDb.collectionGroup = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error("Database error")),
      }),
    });

    const mockThreadsCollection = {
      get: jest.fn().mockResolvedValue({ docs: [] }),
    };

    const mockEventsCollection = {
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ docs: [] }),
      }),
    };

    const mockActionItemsCollection = {
      get: jest.fn().mockResolvedValue({ docs: [] }),
    };

    mockAdminDb.collection = jest.fn((path: string) => {
      if (path.includes("threads")) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test mock doesn't match full Firebase SDK types
        return mockThreadsCollection as any;
      }
      if (path.includes("calendarEvents")) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test mock doesn't match full Firebase SDK types
        return mockEventsCollection as any;
      }
      if (path.includes("actionItems")) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test mock doesn't match full Firebase SDK types
        return mockActionItemsCollection as any;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test mock doesn't match full Firebase SDK types
      return mockCollection as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test mock doesn't match full Firebase SDK types
    }) as any;

    // Transaction should throw error
    mockAdminDb.runTransaction = jest.fn().mockRejectedValue(new Error("Transaction failed"));

    const result = await mergeContacts(
      mockUserId,
      mockPrimaryContactId,
      mockContactIdsToMerge,
      mockPrimaryEmail
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should merge more than 2 contacts (3+ contacts)", async () => {
    const mockPrimaryContact = createMockContact({
      contactId: mockPrimaryContactId,
      primaryEmail: mockPrimaryEmail,
    });
    const mockContact2 = createMockContact({
      contactId: "contact2",
      primaryEmail: "contact2@example.com",
    });
    const mockContact3 = createMockContact({
      contactId: "contact3",
      primaryEmail: "contact3@example.com",
    });

    const contactsMap = new Map<string, Contact>();
    contactsMap.set(mockPrimaryContactId, mockPrimaryContact);
    contactsMap.set("contact2", mockContact2);
    contactsMap.set("contact3", mockContact3);

    const mocks = createFirebaseMocks(contactsMap);
    Object.assign(mockAdminDb, mocks);

    const result = await mergeContacts(
      mockUserId,
      mockPrimaryContactId,
      ["contact2", "contact3"],
      mockPrimaryEmail
    );

    expect(result.success).toBe(true);
    expect(result.mergedContactIds).toEqual(["contact2", "contact3"]);
  });
});

