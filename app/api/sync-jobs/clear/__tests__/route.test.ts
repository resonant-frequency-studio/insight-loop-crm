// Mock dependencies before importing route
jest.mock("@/lib/auth-utils");
jest.mock("@/lib/firebase-admin");
jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
}));
jest.mock("next/cache", () => ({
  revalidateTag: jest.fn(),
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

import { DELETE } from "../route";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { revalidateTag } from "next/cache";
import { reportException } from "@/lib/error-reporting";

const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;
const mockRevalidateTag = revalidateTag as jest.MockedFunction<typeof revalidateTag>;
const mockReportException = reportException as jest.MockedFunction<typeof reportException>;

describe("DELETE /api/sync-jobs/clear", () => {
  const mockUserId = "user123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(mockUserId);
    mockRevalidateTag.mockImplementation(() => {});
  });

  describe("Empty sync history", () => {
    it("should return success when no sync jobs exist", async () => {
      const mockSnapshot = {
        empty: true,
        docs: [],
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockSnapshot),
      };
      (adminDb.collection as jest.Mock) = jest.fn().mockReturnValue(mockCollection);

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(0);
      expect(data.message).toContain("No sync history to clear");
      expect(mockRevalidateTag).not.toHaveBeenCalled();
    });
  });

  describe("Single sync job", () => {
    it("should return success when only one sync job exists", async () => {
      const mockDoc = {
        id: "sync-job-1",
        ref: { delete: jest.fn() },
        data: () => ({
          syncJobId: "sync-job-1",
          userId: mockUserId,
          status: "complete",
          startedAt: new Date(),
        }),
      };
      const mockSnapshot = {
        empty: false,
        docs: [mockDoc],
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockSnapshot),
      };
      (adminDb.collection as jest.Mock) = jest.fn().mockReturnValue(mockCollection);

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(0);
      expect(data.message).toContain("Only one sync job exists");
      expect(mockRevalidateTag).toHaveBeenCalledWith("sync-jobs", "max");
      expect(mockRevalidateTag).toHaveBeenCalledWith(`sync-jobs-${mockUserId}`, "max");
    });
  });

  describe("Multiple sync jobs", () => {
    it("should delete all jobs except the most recent one", async () => {
      const mockDocs = Array.from({ length: 5 }, (_, i) => ({
        id: `sync-job-${i + 1}`,
        ref: { delete: jest.fn() },
        data: () => ({
          syncJobId: `sync-job-${i + 1}`,
          userId: mockUserId,
          status: "complete",
          startedAt: new Date(Date.now() - i * 1000), // Most recent first
        }),
      }));

      const mockSnapshot = {
        empty: false,
        docs: mockDocs,
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockSnapshot),
      };
      (adminDb.collection as jest.Mock) = jest.fn().mockReturnValue(mockCollection);

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (adminDb.batch as jest.Mock) = jest.fn().mockReturnValue(mockBatch);

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(4); // Should delete 4 jobs (keep the first one)
      expect(data.errors).toBe(0);
      expect(data.message).toContain("Cleared 4 sync jobs");
      
      // Verify batch operations
      expect(adminDb.batch).toHaveBeenCalledTimes(1);
      expect(mockBatch.delete).toHaveBeenCalledTimes(4);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
      
      // Verify cache invalidation
      expect(mockRevalidateTag).toHaveBeenCalledWith("sync-jobs", "max");
      expect(mockRevalidateTag).toHaveBeenCalledWith(`sync-jobs-${mockUserId}`, "max");
    });

    it("should handle batch deletion correctly", async () => {
      // Create 10 jobs (should all fit in one batch)
      const mockDocs = Array.from({ length: 10 }, (_, i) => ({
        id: `sync-job-${i + 1}`,
        ref: { delete: jest.fn() },
        data: () => ({
          syncJobId: `sync-job-${i + 1}`,
          userId: mockUserId,
          status: "complete",
          startedAt: new Date(Date.now() - i * 1000),
        }),
      }));

      const mockSnapshot = {
        empty: false,
        docs: mockDocs,
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockSnapshot),
      };
      (adminDb.collection as jest.Mock) = jest.fn().mockReturnValue(mockCollection);

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (adminDb.batch as jest.Mock) = jest.fn().mockReturnValue(mockBatch);

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.deleted).toBe(9); // Keep first, delete 9
      expect(mockBatch.delete).toHaveBeenCalledTimes(9);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it("should handle large batches (more than 500 jobs)", async () => {
      // Create 600 jobs (will need 2 batches)
      const mockDocs = Array.from({ length: 600 }, (_, i) => ({
        id: `sync-job-${i + 1}`,
        ref: { delete: jest.fn() },
        data: () => ({
          syncJobId: `sync-job-${i + 1}`,
          userId: mockUserId,
          status: "complete",
          startedAt: new Date(Date.now() - i * 1000),
        }),
      }));

      const mockSnapshot = {
        empty: false,
        docs: mockDocs,
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockSnapshot),
      };
      (adminDb.collection as jest.Mock) = jest.fn().mockReturnValue(mockCollection);

      const mockBatch1 = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      const mockBatch2 = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (adminDb.batch as jest.Mock)
        .mockReturnValueOnce(mockBatch1)
        .mockReturnValueOnce(mockBatch2);

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.deleted).toBe(599); // Keep first, delete 599
      expect(adminDb.batch).toHaveBeenCalledTimes(2);
      expect(mockBatch1.delete).toHaveBeenCalledTimes(500);
      expect(mockBatch2.delete).toHaveBeenCalledTimes(99);
      expect(mockBatch1.commit).toHaveBeenCalledTimes(1);
      expect(mockBatch2.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error handling", () => {
    it("should handle batch commit errors gracefully", async () => {
      const mockDocs = Array.from({ length: 5 }, (_, i) => ({
        id: `sync-job-${i + 1}`,
        ref: { delete: jest.fn() },
        data: () => ({
          syncJobId: `sync-job-${i + 1}`,
          userId: mockUserId,
          status: "complete",
          startedAt: new Date(Date.now() - i * 1000),
        }),
      }));

      const mockSnapshot = {
        empty: false,
        docs: mockDocs,
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockSnapshot),
      };
      (adminDb.collection as jest.Mock) = jest.fn().mockReturnValue(mockCollection);

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockRejectedValue(new Error("Batch commit failed")),
      };
      (adminDb.batch as jest.Mock) = jest.fn().mockReturnValue(mockBatch);

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.deleted).toBe(0);
      expect(data.errors).toBe(4);
      expect(data.message).toContain("failed to delete");
      expect(mockReportException).toHaveBeenCalled();
    });

    it("should handle partial batch failures", async () => {
      // Create 600 jobs to require 2 batches (500 per batch)
      const mockDocs = Array.from({ length: 600 }, (_, i) => ({
        id: `sync-job-${i + 1}`,
        ref: { delete: jest.fn() },
        data: () => ({
          syncJobId: `sync-job-${i + 1}`,
          userId: mockUserId,
          status: "complete",
          startedAt: new Date(Date.now() - i * 1000),
        }),
      }));

      const mockSnapshot = {
        empty: false,
        docs: mockDocs,
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockSnapshot),
      };
      (adminDb.collection as jest.Mock) = jest.fn().mockReturnValue(mockCollection);

      const mockBatch1 = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined), // First batch succeeds
      };
      const mockBatch2 = {
        delete: jest.fn(),
        commit: jest.fn().mockRejectedValue(new Error("Second batch failed")), // Second batch fails
      };
      (adminDb.batch as jest.Mock)
        .mockReturnValueOnce(mockBatch1)
        .mockReturnValueOnce(mockBatch2);

      // Keep first job, delete 599 jobs (500 in first batch, 99 in second batch)
      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.deleted).toBe(500); // First batch succeeded
      expect(data.errors).toBe(99); // Second batch failed
      expect(mockReportException).toHaveBeenCalled();
    });

    it("should return 500 on unexpected errors", async () => {
      mockGetUserId.mockRejectedValueOnce(new Error("Auth failed"));

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      expect(mockReportException).toHaveBeenCalled();
    });

    it("should handle Firestore query errors", async () => {
      const mockCollection = {
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockRejectedValue(new Error("Firestore query failed")),
      };
      (adminDb.collection as jest.Mock) = jest.fn().mockReturnValue(mockCollection);

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Firestore query failed");
      expect(mockReportException).toHaveBeenCalled();
    });
  });

  describe("Cache invalidation", () => {
    it("should invalidate cache tags after successful deletion", async () => {
      const mockDocs = Array.from({ length: 3 }, (_, i) => ({
        id: `sync-job-${i + 1}`,
        ref: { delete: jest.fn() },
        data: () => ({
          syncJobId: `sync-job-${i + 1}`,
          userId: mockUserId,
          status: "complete",
          startedAt: new Date(Date.now() - i * 1000),
        }),
      }));

      const mockSnapshot = {
        empty: false,
        docs: mockDocs,
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockSnapshot),
      };
      (adminDb.collection as jest.Mock) = jest.fn().mockReturnValue(mockCollection);

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (adminDb.batch as jest.Mock) = jest.fn().mockReturnValue(mockBatch);

      await DELETE();

      expect(mockRevalidateTag).toHaveBeenCalledWith("sync-jobs", "max");
      expect(mockRevalidateTag).toHaveBeenCalledWith(`sync-jobs-${mockUserId}`, "max");
    });

    it("should invalidate cache even when no jobs are deleted", async () => {
      const mockDoc = {
        id: "sync-job-1",
        ref: { delete: jest.fn() },
        data: () => ({
          syncJobId: "sync-job-1",
          userId: mockUserId,
          status: "complete",
          startedAt: new Date(),
        }),
      };
      const mockSnapshot = {
        empty: false,
        docs: [mockDoc],
      };
      const mockCollection = {
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockSnapshot),
      };
      (adminDb.collection as jest.Mock) = jest.fn().mockReturnValue(mockCollection);

      await DELETE();

      expect(mockRevalidateTag).toHaveBeenCalledWith("sync-jobs", "max");
      expect(mockRevalidateTag).toHaveBeenCalledWith(`sync-jobs-${mockUserId}`, "max");
    });
  });
});

