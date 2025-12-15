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

import { POST } from "../route";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { revalidateTag } from "next/cache";

const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;
const mockRevalidateTag = revalidateTag as jest.MockedFunction<typeof revalidateTag>;

describe("POST /api/contacts/bulk-archive", () => {
  const mockUserId = "user123";
  const mockContactIds = ["contact1", "contact2", "contact3"];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(mockUserId);
    mockRevalidateTag.mockImplementation(() => {});
  });

  describe("Input validation", () => {
    it("should return 400 if contactIds is not an array", async () => {
      const req = new Request("http://localhost/api/contacts/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: "not-an-array", archived: true }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("contactIds must be a non-empty array");
    });

    it("should return 400 if contactIds is empty", async () => {
      const req = new Request("http://localhost/api/contacts/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: [], archived: true }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("contactIds must be a non-empty array");
    });

    it("should return 400 if archived is not a boolean", async () => {
      const req = new Request("http://localhost/api/contacts/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: mockContactIds, archived: "true" }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("archived must be a boolean");
    });
  });

  describe("Bulk update functionality", () => {
    it("should archive all contacts successfully", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({ update: mockUpdate }),
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };
      (adminDb.collection as jest.Mock) = jest.fn((path: string) => {
        if (path === "users") {
          return mockUsersCollection;
        }
        return mockContactsCollection;
      });

      const req = new Request("http://localhost/api/contacts/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: mockContactIds, archived: true }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(3);
      expect(data.errors).toBe(0);
      expect(mockUpdate).toHaveBeenCalledTimes(3);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          archived: true,
        })
      );
    });

    it("should unarchive all contacts successfully", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({ update: mockUpdate }),
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };
      (adminDb.collection as jest.Mock) = jest.fn((path: string) => {
        if (path === "users") {
          return mockUsersCollection;
        }
        return mockContactsCollection;
      });

      const req = new Request("http://localhost/api/contacts/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: mockContactIds, archived: false }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(3);
      expect(data.errors).toBe(0);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          archived: false,
        })
      );
    });

    it("should handle errors gracefully", async () => {
      const mockUpdate = jest
        .fn()
        .mockRejectedValueOnce(new Error("Update failed"))
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({ update: mockUpdate }),
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };
      (adminDb.collection as jest.Mock) = jest.fn((path: string) => {
        if (path === "users") {
          return mockUsersCollection;
        }
        return mockContactsCollection;
      });

      const req = new Request("http://localhost/api/contacts/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: mockContactIds, archived: true }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(2);
      expect(data.errors).toBe(1);
      expect(data.errorDetails).toHaveLength(1);
      expect(data.errorDetails[0]).toContain("contact1");
    });

    it("should process contacts in batches of 10", async () => {
      const largeContactIds = Array.from({ length: 25 }, (_, i) => `contact${i}`);
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({ update: mockUpdate }),
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };
      (adminDb.collection as jest.Mock) = jest.fn((path: string) => {
        if (path === "users") {
          return mockUsersCollection;
        }
        return mockContactsCollection;
      });

      const req = new Request("http://localhost/api/contacts/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: largeContactIds, archived: true }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(25);
      expect(data.errors).toBe(0);
      expect(mockUpdate).toHaveBeenCalledTimes(25);
    });
  });

  describe("Cache invalidation", () => {
    it("should invalidate cache tags on success", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({ update: mockUpdate }),
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };
      (adminDb.collection as jest.Mock) = jest.fn((path: string) => {
        if (path === "users") {
          return mockUsersCollection;
        }
        return mockContactsCollection;
      });

      const req = new Request("http://localhost/api/contacts/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: mockContactIds, archived: true }),
      });

      await POST(req);

      expect(mockRevalidateTag).toHaveBeenCalledWith("contacts", "max");
      expect(mockRevalidateTag).toHaveBeenCalledWith(`contacts-${mockUserId}`, "max");
      mockContactIds.forEach((contactId) => {
        expect(mockRevalidateTag).toHaveBeenCalledWith(
          `contact-${mockUserId}-${contactId}`,
          "max"
        );
      });
    });

    it("should not invalidate cache if all updates fail", async () => {
      const mockUpdate = jest.fn().mockRejectedValue(new Error("Update failed"));
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({ update: mockUpdate }),
      };
      const mockUsersDoc = {
        collection: jest.fn().mockReturnValue(mockContactsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUsersDoc),
      };
      (adminDb.collection as jest.Mock) = jest.fn((path: string) => {
        if (path === "users") {
          return mockUsersCollection;
        }
        return mockContactsCollection;
      });

      const req = new Request("http://localhost/api/contacts/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: mockContactIds, archived: true }),
      });

      await POST(req);

      expect(mockRevalidateTag).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should return 500 on unexpected errors", async () => {
      mockGetUserId.mockRejectedValueOnce(new Error("Auth failed"));

      const req = new Request("http://localhost/api/contacts/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: mockContactIds, archived: true }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
