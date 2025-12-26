import {
  getLastSyncForUser,
  getSyncHistoryForUser,
} from "../sync-jobs-server";
import { adminDb } from "../firebase-admin";
import { createMockDocSnapshot, createMockQuerySnapshot } from "../__mocks__/firebase-admin";
import { SyncJob } from "@/types/firestore";

// Mock the firebase-admin module
jest.mock("../firebase-admin", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockModule = require("../__mocks__/firebase-admin");
  return {
    adminDb: mockModule.adminDb,
  };
});

// Mock error reporting
jest.mock("../error-reporting", () => ({
  reportException: jest.fn(),
}));

describe("sync-jobs-server", () => {
  const mockUserId = "user123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getLastSyncForUser", () => {
    it("should return the most recent sync job", async () => {
      const mockSyncJob: SyncJob = {
        syncJobId: "sync1",
        userId: mockUserId,
        service: "gmail",
        type: "incremental",
        status: "complete",
        startedAt: { toDate: () => new Date("2024-01-01") },
        finishedAt: { toDate: () => new Date("2024-01-02") },
        processedThreads: 10,
        processedMessages: 25,
      };

      const mockDoc = createMockDocSnapshot(mockSyncJob, "sync1");
      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(createMockQuerySnapshot([mockDoc])),
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnValue(mockQuery),
      };
      
      (adminDb.collection as jest.Mock).mockReturnValue(mockCollection);

      const result = await getLastSyncForUser(mockUserId);

      expect(result).toBeDefined();
      expect(result?.syncJobId).toBe("sync1");
      expect(result?.status).toBe("complete");
      expect(typeof result?.startedAt).toBe("string"); // Should be ISO string
      expect(typeof result?.finishedAt).toBe("string"); // Should be ISO string
      expect(mockCollection.orderBy).toHaveBeenCalledWith("startedAt", "desc");
      expect(mockQuery.limit).toHaveBeenCalledWith(1);
    });

    it("should return null when no sync jobs exist", async () => {
      const emptySnapshot = createMockQuerySnapshot([]);
      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(emptySnapshot),
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnValue(mockQuery),
      };
      
      (adminDb.collection as jest.Mock).mockReturnValue(mockCollection);

      const result = await getLastSyncForUser(mockUserId);

      expect(result).toBeNull();
    });

    it("should handle quota exceeded errors", async () => {
      const quotaError = new Error("RESOURCE_EXHAUSTED: Quota exceeded");
      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockRejectedValue(quotaError),
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnValue(mockQuery),
      };
      
      (adminDb.collection as jest.Mock).mockReturnValue(mockCollection);

      await expect(getLastSyncForUser(mockUserId)).rejects.toThrow(
        "Database quota exceeded"
      );
    });

    it("should handle other errors", async () => {
      const error = new Error("Network error");
      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockRejectedValue(error),
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnValue(mockQuery),
      };
      
      (adminDb.collection as jest.Mock).mockReturnValue(mockCollection);

      await expect(getLastSyncForUser(mockUserId)).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("getSyncHistoryForUser", () => {
    it("should return sync history ordered by startedAt descending", async () => {
      const mockSyncJob1: SyncJob = {
        syncJobId: "sync1",
        userId: mockUserId,
        service: "gmail",
        type: "incremental",
        status: "complete",
        startedAt: { toDate: () => new Date("2024-01-02") },
        processedThreads: 10,
        processedMessages: 25,
      };

      const mockSyncJob2: SyncJob = {
        syncJobId: "sync2",
        userId: mockUserId,
        service: "gmail",
        type: "initial",
        status: "complete",
        startedAt: { toDate: () => new Date("2024-01-01") },
        processedThreads: 5,
        processedMessages: 15,
      };

      const mockDocs = [
        createMockDocSnapshot(mockSyncJob1, "sync1"),
        createMockDocSnapshot(mockSyncJob2, "sync2"),
      ];
      const snapshot = createMockQuerySnapshot(mockDocs);
      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(snapshot),
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnValue(mockQuery),
      };
      
      (adminDb.collection as jest.Mock).mockReturnValue(mockCollection);

      const result = await getSyncHistoryForUser(mockUserId, 10);

      expect(result).toHaveLength(2);
      expect(result[0].syncJobId).toBe("sync1");
      expect(result[1].syncJobId).toBe("sync2");
      expect(typeof result[0].startedAt).toBe("string");
      expect(typeof result[1].startedAt).toBe("string");
      expect(mockCollection.orderBy).toHaveBeenCalledWith("startedAt", "desc");
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it("should return empty array when no sync history exists", async () => {
      const emptySnapshot = createMockQuerySnapshot([]);
      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(emptySnapshot),
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnValue(mockQuery),
      };
      
      (adminDb.collection as jest.Mock).mockReturnValue(mockCollection);

      const result = await getSyncHistoryForUser(mockUserId);

      expect(result).toEqual([]);
    });

    it("should respect the limit parameter", async () => {
      const mockSyncJob: SyncJob = {
        syncJobId: "sync1",
        userId: mockUserId,
        service: "gmail",
        type: "incremental",
        status: "complete",
        startedAt: { toDate: () => new Date("2024-01-01") },
        processedThreads: 10,
        processedMessages: 25,
      };

      const mockDoc = createMockDocSnapshot(mockSyncJob, "sync1");
      const snapshot = createMockQuerySnapshot([mockDoc]);
      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(snapshot),
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnValue(mockQuery),
      };
      
      (adminDb.collection as jest.Mock).mockReturnValue(mockCollection);

      await getSyncHistoryForUser(mockUserId, 5);

      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    it("should use default limit of 10 when not specified", async () => {
      const emptySnapshot = createMockQuerySnapshot([]);
      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(emptySnapshot),
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnValue(mockQuery),
      };
      
      (adminDb.collection as jest.Mock).mockReturnValue(mockCollection);

      await getSyncHistoryForUser(mockUserId);

      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it("should handle quota exceeded errors", async () => {
      const quotaError = new Error("RESOURCE_EXHAUSTED: Quota exceeded");
      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockRejectedValue(quotaError),
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnValue(mockQuery),
      };
      
      (adminDb.collection as jest.Mock).mockReturnValue(mockCollection);

      await expect(getSyncHistoryForUser(mockUserId)).rejects.toThrow(
        "Database quota exceeded"
      );
    });

    it("should handle other errors", async () => {
      const error = new Error("Network error");
      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockRejectedValue(error),
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnValue(mockQuery),
      };
      
      (adminDb.collection as jest.Mock).mockReturnValue(mockCollection);

      await expect(getSyncHistoryForUser(mockUserId)).rejects.toThrow(
        "Network error"
      );
    });
  });
});

