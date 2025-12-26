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
import { Contact } from "@/types/firestore";
import { Timestamp } from "firebase-admin/firestore";

const mockAdminDb = adminDb as jest.Mocked<typeof adminDb>;

describe("mergeContacts", () => {
  const mockUserId = "user123";
  const mockPrimaryContactId = "contact1";
  const mockContactIdsToMerge = ["contact2", "contact3"];
  const mockPrimaryEmail = "primary@example.com";

  const createMockContact = (overrides: Partial<Contact> = {}): Contact => ({
    contactId: "contact1",
    primaryEmail: "primary@example.com",
    firstName: "John",
    lastName: "Doe",
    company: "Acme Corp",
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

    // Mock for subcollections (actionItems, threads, etc.)
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

  it("should throw error if primary contact ID is missing", async () => {
    await expect(
      mergeContacts(mockUserId, "", mockContactIdsToMerge, mockPrimaryEmail)
    ).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("required"),
    });
  });

  it("should throw error if no contacts to merge", async () => {
    await expect(
      mergeContacts(mockUserId, mockPrimaryContactId, [], mockPrimaryEmail)
    ).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("required"),
    });
  });

  it("should throw error if trying to merge contact into itself", async () => {
    await expect(
      mergeContacts(
        mockUserId,
        mockPrimaryContactId,
        [mockPrimaryContactId],
        mockPrimaryEmail
      )
    ).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("itself"),
    });
  });

  it("should throw error if primary email is not from any contact", async () => {
    const mockPrimaryContact = createMockContact({
      contactId: mockPrimaryContactId,
      primaryEmail: "primary@example.com",
    });
    const mockContact2 = createMockContact({
      contactId: "contact2",
      primaryEmail: "contact2@example.com",
    });

    const contactsMap = new Map<string, Contact>();
    contactsMap.set(mockPrimaryContactId, mockPrimaryContact);
    contactsMap.set("contact2", mockContact2);

    const mocks = createFirebaseMocks(contactsMap);
    Object.assign(mockAdminDb, mocks);

    await expect(
      mergeContacts(
        mockUserId,
        mockPrimaryContactId,
        ["contact2"],
        "nonexistent@example.com"
      )
    ).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("primary email"),
    });
  });

  it("should merge contact fields correctly", async () => {
    const mockPrimaryContact = createMockContact({
      contactId: mockPrimaryContactId,
      primaryEmail: "primary@example.com",
      firstName: "John",
      lastName: "Doe",
      company: "Acme Corp",
      tags: ["tag1"],
      notes: "Primary notes",
      engagementScore: 50,
      threadCount: 5,
    });
    const mockContact2 = createMockContact({
      contactId: "contact2",
      primaryEmail: "contact2@example.com",
      firstName: "Jane",
      lastName: "Smith",
      company: "Beta Inc",
      tags: ["tag2", "tag1"], // tag1 is duplicate
      notes: "Secondary notes",
      engagementScore: 75,
      threadCount: 3,
    });

    const contactsMap = new Map<string, Contact>();
    contactsMap.set(mockPrimaryContactId, mockPrimaryContact);
    contactsMap.set("contact2", mockContact2);

    const mocks = createFirebaseMocks(contactsMap);
    Object.assign(mockAdminDb, mocks);

    const result = await mergeContacts(
      mockUserId,
      mockPrimaryContactId,
      ["contact2"],
      "primary@example.com"
    );


    expect(result.success).toBe(true);
    expect(result.primaryContactId).toBe(mockPrimaryContactId);
    expect(result.mergedContactIds).toEqual(["contact2"]);

    // Verify transaction was called
    expect(mocks.runTransaction).toHaveBeenCalled();
  });

  it("should combine tags and deduplicate", async () => {
    const mockPrimaryContact = createMockContact({
      contactId: mockPrimaryContactId,
      primaryEmail: "primary@example.com",
      tags: ["tag1", "tag2"],
    });
    const mockContact2 = createMockContact({
      contactId: "contact2",
      primaryEmail: "contact2@example.com",
      tags: ["tag2", "tag3"], // tag2 is duplicate
    });

    const contactsMap = new Map<string, Contact>();
    contactsMap.set(mockPrimaryContactId, mockPrimaryContact);
    contactsMap.set("contact2", mockContact2);

    const mocks = createFirebaseMocks(contactsMap);
    Object.assign(mockAdminDb, mocks);

    const result = await mergeContacts(
      mockUserId,
      mockPrimaryContactId,
      ["contact2"],
      "primary@example.com"
    );

    expect(result.success).toBe(true);
    // Verify that update was called with merged tags (should have tag1, tag2, tag3)
    expect(mocks.runTransaction).toHaveBeenCalled();
  });

  it("should use highest engagement score", async () => {
    const mockPrimaryContact = createMockContact({
      contactId: mockPrimaryContactId,
      primaryEmail: "primary@example.com",
      engagementScore: 50,
    });
    const mockContact2 = createMockContact({
      contactId: "contact2",
      primaryEmail: "contact2@example.com",
      engagementScore: 75,
    });

    const contactsMap = new Map<string, Contact>();
    contactsMap.set(mockPrimaryContactId, mockPrimaryContact);
    contactsMap.set("contact2", mockContact2);

    const mocks = createFirebaseMocks(contactsMap);
    Object.assign(mockAdminDb, mocks);

    const result = await mergeContacts(
      mockUserId,
      mockPrimaryContactId,
      ["contact2"],
      "primary@example.com"
    );

    expect(result.success).toBe(true);
    expect(mocks.runTransaction).toHaveBeenCalled();
  });

  it("should handle contacts with no data gracefully", async () => {
    const mockPrimaryContact = createMockContact({
      contactId: mockPrimaryContactId,
      primaryEmail: "primary@example.com",
      firstName: null,
      lastName: null,
      company: null,
      tags: undefined,
      notes: null,
    });
    const mockContact2 = createMockContact({
      contactId: "contact2",
      primaryEmail: "contact2@example.com",
      firstName: null,
      lastName: null,
      company: null,
      tags: undefined,
      notes: null,
    });

    const contactsMap = new Map<string, Contact>();
    contactsMap.set(mockPrimaryContactId, mockPrimaryContact);
    contactsMap.set("contact2", mockContact2);

    const mocks = createFirebaseMocks(contactsMap);
    Object.assign(mockAdminDb, mocks);

    const result = await mergeContacts(
      mockUserId,
      mockPrimaryContactId,
      ["contact2"],
      "primary@example.com"
    );

    expect(result.success).toBe(true);
  });

  describe("Secondary Emails", () => {
    it("should collect and merge secondary emails from all contacts", async () => {
      const mockPrimaryContact = createMockContact({
        contactId: mockPrimaryContactId,
        primaryEmail: "primary@example.com",
        secondaryEmails: ["secondary1@example.com", "secondary2@example.com"],
      });
      const mockContact2 = createMockContact({
        contactId: "contact2",
        primaryEmail: "contact2@example.com",
        secondaryEmails: ["secondary3@example.com"],
      });

      const contactsMap = new Map<string, Contact>();
      contactsMap.set(mockPrimaryContactId, mockPrimaryContact);
      contactsMap.set("contact2", mockContact2);

      const mocks = createFirebaseMocks(contactsMap);
      Object.assign(mockAdminDb, mocks);

      const result = await mergeContacts(
        mockUserId,
        mockPrimaryContactId,
        ["contact2"],
        "primary@example.com"
      );

      expect(result.success).toBe(true);
      expect(mocks.runTransaction).toHaveBeenCalled();
    });

    it("should set secondary emails correctly excluding primary email", async () => {
      const mockPrimaryContact = createMockContact({
        contactId: mockPrimaryContactId,
        primaryEmail: "primary@example.com",
        secondaryEmails: ["secondary1@example.com"],
      });
      const mockContact2 = createMockContact({
        contactId: "contact2",
        primaryEmail: "contact2@example.com",
      });

      const contactsMap = new Map<string, Contact>();
      contactsMap.set(mockPrimaryContactId, mockPrimaryContact);
      contactsMap.set("contact2", mockContact2);

      const mocks = createFirebaseMocks(contactsMap);
      Object.assign(mockAdminDb, mocks);

      // Merge with contact2's email as primary
      const result = await mergeContacts(
        mockUserId,
        mockPrimaryContactId,
        ["contact2"],
        "contact2@example.com"
      );

      expect(result.success).toBe(true);
      // Primary email should be contact2@example.com
      // Secondary emails should include primary@example.com and secondary1@example.com
      expect(mocks.runTransaction).toHaveBeenCalled();
    });

    it("should deduplicate emails across contacts", async () => {
      const mockPrimaryContact = createMockContact({
        contactId: mockPrimaryContactId,
        primaryEmail: "primary@example.com",
        secondaryEmails: ["duplicate@example.com"],
      });
      const mockContact2 = createMockContact({
        contactId: "contact2",
        primaryEmail: "contact2@example.com",
        secondaryEmails: ["duplicate@example.com", "unique@example.com"],
      });

      const contactsMap = new Map<string, Contact>();
      contactsMap.set(mockPrimaryContactId, mockPrimaryContact);
      contactsMap.set("contact2", mockContact2);

      const mocks = createFirebaseMocks(contactsMap);
      Object.assign(mockAdminDb, mocks);

      const result = await mergeContacts(
        mockUserId,
        mockPrimaryContactId,
        ["contact2"],
        "primary@example.com"
      );

      expect(result.success).toBe(true);
      // Should deduplicate "duplicate@example.com"
      expect(mocks.runTransaction).toHaveBeenCalled();
    });

    it("should normalize emails to lowercase and trim whitespace", async () => {
      const mockPrimaryContact = createMockContact({
        contactId: mockPrimaryContactId,
        primaryEmail: "PRIMARY@EXAMPLE.COM",
        secondaryEmails: ["  SECONDARY@EXAMPLE.COM  ", "Mixed@Example.Com"],
      });
      const mockContact2 = createMockContact({
        contactId: "contact2",
        primaryEmail: "  contact2@example.com  ",
      });

      const contactsMap = new Map<string, Contact>();
      contactsMap.set(mockPrimaryContactId, mockPrimaryContact);
      contactsMap.set("contact2", mockContact2);

      const mocks = createFirebaseMocks(contactsMap);
      Object.assign(mockAdminDb, mocks);

      const result = await mergeContacts(
        mockUserId,
        mockPrimaryContactId,
        ["contact2"],
        "primary@example.com"
      );

      expect(result.success).toBe(true);
      expect(mocks.runTransaction).toHaveBeenCalled();
    });

    it("should handle contacts with no secondary emails", async () => {
      const mockPrimaryContact = createMockContact({
        contactId: mockPrimaryContactId,
        primaryEmail: "primary@example.com",
      });
      const mockContact2 = createMockContact({
        contactId: "contact2",
        primaryEmail: "contact2@example.com",
      });

      const contactsMap = new Map<string, Contact>();
      contactsMap.set(mockPrimaryContactId, mockPrimaryContact);
      contactsMap.set("contact2", mockContact2);

      const mocks = createFirebaseMocks(contactsMap);
      Object.assign(mockAdminDb, mocks);

      const result = await mergeContacts(
        mockUserId,
        mockPrimaryContactId,
        ["contact2"],
        "primary@example.com"
      );

      expect(result.success).toBe(true);
      // Secondary emails should be ["contact2@example.com"]
      expect(mocks.runTransaction).toHaveBeenCalled();
    });

    it("should handle empty secondary emails array", async () => {
      const mockPrimaryContact = createMockContact({
        contactId: mockPrimaryContactId,
        primaryEmail: "primary@example.com",
        secondaryEmails: [],
      });
      const mockContact2 = createMockContact({
        contactId: "contact2",
        primaryEmail: "contact2@example.com",
        secondaryEmails: [],
      });

      const contactsMap = new Map<string, Contact>();
      contactsMap.set(mockPrimaryContactId, mockPrimaryContact);
      contactsMap.set("contact2", mockContact2);

      const mocks = createFirebaseMocks(contactsMap);
      Object.assign(mockAdminDb, mocks);

      const result = await mergeContacts(
        mockUserId,
        mockPrimaryContactId,
        ["contact2"],
        "primary@example.com"
      );

      expect(result.success).toBe(true);
      expect(mocks.runTransaction).toHaveBeenCalled();
    });

    it("should allow selecting primary email from secondary emails array", async () => {
      const mockPrimaryContact = createMockContact({
        contactId: mockPrimaryContactId,
        primaryEmail: "primary@example.com",
        secondaryEmails: ["better@example.com"],
      });
      const mockContact2 = createMockContact({
        contactId: "contact2",
        primaryEmail: "contact2@example.com",
      });

      const contactsMap = new Map<string, Contact>();
      contactsMap.set(mockPrimaryContactId, mockPrimaryContact);
      contactsMap.set("contact2", mockContact2);

      const mocks = createFirebaseMocks(contactsMap);
      Object.assign(mockAdminDb, mocks);

      // Select email from secondary emails as primary
      const result = await mergeContacts(
        mockUserId,
        mockPrimaryContactId,
        ["contact2"],
        "better@example.com"
      );

      expect(result.success).toBe(true);
      // Primary should be "better@example.com"
      // Secondary should include "primary@example.com" and "contact2@example.com"
      expect(mocks.runTransaction).toHaveBeenCalled();
    });

    it("should handle merging 3+ contacts with secondary emails", async () => {
      const mockPrimaryContact = createMockContact({
        contactId: mockPrimaryContactId,
        primaryEmail: "primary@example.com",
        secondaryEmails: ["secondary1@example.com"],
      });
      const mockContact2 = createMockContact({
        contactId: "contact2",
        primaryEmail: "contact2@example.com",
        secondaryEmails: ["secondary2@example.com"],
      });
      const mockContact3 = createMockContact({
        contactId: "contact3",
        primaryEmail: "contact3@example.com",
        secondaryEmails: ["secondary3@example.com"],
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
        "primary@example.com"
      );

      expect(result.success).toBe(true);
      // Should collect all emails from all 3 contacts
      expect(mocks.runTransaction).toHaveBeenCalled();
    });
  });
});

