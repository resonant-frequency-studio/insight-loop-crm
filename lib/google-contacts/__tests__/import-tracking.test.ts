import { adminDb } from "@/lib/firebase-admin";
import {
  isContactPreviouslyImported,
  markContactAsImported,
  batchCheckPreviouslyImported,
} from "../import-tracking";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
      })),
      where: jest.fn(() => ({
        get: jest.fn(),
      })),
    })),
  },
}));

describe("import-tracking", () => {
  const mockUserId = "user-123";
  const mockEmail = "test@example.com";
  const mockNormalizedEmail = "test@example.com";
  const mockContactId = "contact-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isContactPreviouslyImported", () => {
    it("returns false for invalid email", async () => {
      const result = await isContactPreviouslyImported(mockUserId, "");
      expect(result).toBe(false);
    });

    it("returns false for email without @", async () => {
      const result = await isContactPreviouslyImported(mockUserId, "invalid-email");
      expect(result).toBe(false);
    });

    it("returns true when contact was previously imported", async () => {
      const mockGet = jest.fn().mockResolvedValue({
        exists: true,
      });
      const mockImportedContactsDoc = jest.fn().mockReturnValue({
        get: mockGet,
      });
      const mockImportedContactsCollection = {
        doc: mockImportedContactsDoc,
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockImportedContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };

      (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

      const result = await isContactPreviouslyImported(mockUserId, mockEmail);
      expect(result).toBe(true);
      expect(mockGet).toHaveBeenCalled();
    });

    it("returns false when contact was not previously imported", async () => {
      const mockGet = jest.fn().mockResolvedValue({
        exists: false,
      });
      const mockImportedContactsDoc = jest.fn().mockReturnValue({
        get: mockGet,
      });
      const mockImportedContactsCollection = {
        doc: mockImportedContactsDoc,
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockImportedContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };

      (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

      const result = await isContactPreviouslyImported(mockUserId, mockEmail);
      expect(result).toBe(false);
      expect(mockGet).toHaveBeenCalled();
    });

    it("normalizes email to lowercase", async () => {
      const mockGet = jest.fn().mockResolvedValue({
        exists: true,
      });
      const mockImportedContactsDoc = jest.fn().mockReturnValue({
        get: mockGet,
      });
      const mockImportedContactsCollection = {
        doc: mockImportedContactsDoc,
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockImportedContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };

      (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

      await isContactPreviouslyImported(mockUserId, "Test@Example.com");
      
      expect(mockImportedContactsDoc).toHaveBeenCalledWith("test@example.com");
    });
  });

  describe("markContactAsImported", () => {
    it("does nothing for invalid email", async () => {
      const mockSet = jest.fn();
      const mockImportedContactsDoc = jest.fn().mockReturnValue({
        set: mockSet,
      });
      const mockImportedContactsCollection = {
        doc: mockImportedContactsDoc,
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockImportedContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };

      (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

      await markContactAsImported(mockUserId, "", mockContactId);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("does nothing for email without @", async () => {
      const mockSet = jest.fn();
      const mockImportedContactsDoc = jest.fn().mockReturnValue({
        set: mockSet,
      });
      const mockImportedContactsCollection = {
        doc: mockImportedContactsDoc,
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockImportedContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };

      (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

      await markContactAsImported(mockUserId, "invalid-email", mockContactId);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("marks contact as imported with correct data", async () => {
      const mockSet = jest.fn().mockResolvedValue(undefined);
      const mockImportedContactsDoc = jest.fn().mockReturnValue({
        set: mockSet,
      });
      const mockImportedContactsCollection = {
        doc: mockImportedContactsDoc,
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockImportedContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };

      (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

      await markContactAsImported(mockUserId, mockEmail, mockContactId);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockNormalizedEmail,
          contactId: mockContactId,
        })
      );
    });

    it("normalizes email to lowercase", async () => {
      const mockSet = jest.fn().mockResolvedValue(undefined);
      const mockImportedContactsDoc = jest.fn().mockReturnValue({
        set: mockSet,
      });
      const mockImportedContactsCollection = {
        doc: mockImportedContactsDoc,
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockImportedContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };

      (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

      await markContactAsImported(mockUserId, "Test@Example.com", mockContactId);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
        })
      );
    });
  });

  describe("batchCheckPreviouslyImported", () => {
    it("returns empty map for empty emails array", async () => {
      const result = await batchCheckPreviouslyImported(mockUserId, []);
      expect(result.size).toBe(0);
    });

    it("returns empty map for emails without @", async () => {
      const result = await batchCheckPreviouslyImported(mockUserId, ["invalid-email"]);
      expect(result.size).toBe(0);
    });

    it("returns correct results for single batch", async () => {
      const emails = ["test1@example.com", "test2@example.com", "test3@example.com"];
      const mockSnapshot = {
        empty: false,
        forEach: jest.fn((callback) => {
          // Simulate test1@example.com was imported
          callback({
            data: () => ({ email: "test1@example.com" }),
          });
        }),
      };

      const mockGet = jest.fn().mockResolvedValue(mockSnapshot);
      const mockWhere = jest.fn().mockReturnValue({
        get: mockGet,
      });
      const mockImportedContactsCollection = {
        where: mockWhere,
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockImportedContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };

      (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

      const result = await batchCheckPreviouslyImported(mockUserId, emails);

      expect(result.get("test1@example.com")).toBe(true);
      expect(result.get("test2@example.com")).toBe(false);
      expect(result.get("test3@example.com")).toBe(false);
    });

    it("processes emails in batches of 10", async () => {
      const emails = Array.from({ length: 25 }, (_, i) => `test${i}@example.com`);
      const mockGet = jest.fn().mockResolvedValue({
        empty: false,
        forEach: jest.fn(),
      });
      const mockWhere = jest.fn().mockReturnValue({
        get: mockGet,
      });
      const mockImportedContactsCollection = {
        where: mockWhere,
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockImportedContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };

      (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

      await batchCheckPreviouslyImported(mockUserId, emails);

      // Should be called 3 times (25 emails / 10 per batch = 3 batches)
      expect(mockGet).toHaveBeenCalledTimes(3);
    });

    it("normalizes emails to lowercase", async () => {
      const emails = ["Test@Example.com", "TEST@EXAMPLE.COM"];
      const mockSnapshot = {
        empty: false,
        forEach: jest.fn((callback) => {
          callback({
            data: () => ({ email: "test@example.com" }),
          });
        }),
      };

      const mockGet = jest.fn().mockResolvedValue(mockSnapshot);
      const mockWhere = jest.fn().mockReturnValue({
        get: mockGet,
      });
      const mockImportedContactsCollection = {
        where: mockWhere,
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockImportedContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };

      (adminDb.collection as jest.Mock).mockReturnValue(mockUsersCollection);

      const result = await batchCheckPreviouslyImported(mockUserId, emails);

      expect(result.get("test@example.com")).toBe(true);
      expect(result.get("test@example.com")).toBe(true); // Both normalize to same
    });
  });
});

