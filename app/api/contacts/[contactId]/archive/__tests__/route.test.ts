// Mock dependencies before importing route
jest.mock("@/lib/auth-utils");
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {},
}));
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

import { PATCH } from "../route";
import { getUserId } from "@/lib/auth-utils";
import { adminDb } from "@/lib/firebase-admin";
import { revalidateTag } from "next/cache";

const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;
const mockRevalidateTag = revalidateTag as jest.MockedFunction<typeof revalidateTag>;

describe("PATCH /api/contacts/[contactId]/archive", () => {
  const mockUserId = "user123";
  const mockContactId = "contact123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(mockUserId);
    mockRevalidateTag.mockImplementation(() => {});
  });

  describe("Input validation", () => {
    it("should return 400 if archived is not a boolean", async () => {
      const req = new Request("http://localhost/api/contacts/contact123/archive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: "true" }),
      });

      const params = Promise.resolve({ contactId: mockContactId });

      const response = await PATCH(req, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("archived must be a boolean");
    });
  });

  describe("Archive functionality", () => {
    it("should archive a contact successfully", async () => {
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

      const req = new Request("http://localhost/api/contacts/contact123/archive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });

      const params = Promise.resolve({ contactId: mockContactId });

      const response = await PATCH(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          archived: true,
        })
      );
    });

    it("should unarchive a contact successfully", async () => {
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

      const req = new Request("http://localhost/api/contacts/contact123/archive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });

      const params = Promise.resolve({ contactId: mockContactId });

      const response = await PATCH(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          archived: false,
        })
      );
    });

    it("should decode contactId from URL", async () => {
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

      const encodedContactId = encodeURIComponent("contact@example.com");
      const req = new Request(`http://localhost/api/contacts/${encodedContactId}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });

      const params = Promise.resolve({ contactId: encodedContactId });

      await PATCH(req, { params });

      expect(mockContactsCollection.doc).toHaveBeenCalledWith("contact@example.com");
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

      const req = new Request("http://localhost/api/contacts/contact123/archive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });

      const params = Promise.resolve({ contactId: mockContactId });

      await PATCH(req, { params });

      expect(mockRevalidateTag).toHaveBeenCalledWith("contacts", "max");
      expect(mockRevalidateTag).toHaveBeenCalledWith(`contacts-${mockUserId}`, "max");
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `contact-${mockUserId}-${mockContactId}`,
        "max"
      );
    });
  });

  describe("Error handling", () => {
    it("should return 500 on database errors", async () => {
      const mockUpdate = jest.fn().mockRejectedValue(new Error("Database error"));
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

      const req = new Request("http://localhost/api/contacts/contact123/archive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });

      const params = Promise.resolve({ contactId: mockContactId });

      const response = await PATCH(req, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it("should return 500 on auth errors", async () => {
      mockGetUserId.mockRejectedValueOnce(new Error("Auth failed"));

      const req = new Request("http://localhost/api/contacts/contact123/archive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });

      const params = Promise.resolve({ contactId: mockContactId });

      const response = await PATCH(req, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
