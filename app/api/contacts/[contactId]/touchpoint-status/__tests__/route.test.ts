// Mock dependencies before importing route
jest.mock("@/lib/auth-utils");
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {},
}));
jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
}));
jest.mock("@/util/timestamp-utils-server", () => ({
  convertTimestamp: jest.fn((ts) => ts),
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
import { convertTimestamp } from "@/util/timestamp-utils-server";

const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;
const mockRevalidateTag = revalidateTag as jest.MockedFunction<typeof revalidateTag>;
const mockConvertTimestamp = convertTimestamp as jest.MockedFunction<typeof convertTimestamp>;

describe("PATCH /api/contacts/[contactId]/touchpoint-status", () => {
  const mockUserId = "user123";
  const mockContactId = "contact123";
  const mockContactData = {
    contactId: mockContactId,
    primaryEmail: "test@example.com",
    firstName: "Test",
    lastName: "User",
    touchpointStatus: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(mockUserId);
    mockConvertTimestamp.mockImplementation((ts) => ts);
    mockRevalidateTag.mockImplementation(() => {});
  });

  describe("Input validation", () => {
    it("should return 400 if status is invalid", async () => {
      const req = new Request("http://localhost/api/contacts/contact123/touchpoint-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid-status" }),
      });

      const params = Promise.resolve({ contactId: mockContactId });
      const response = await PATCH(req, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid status");
    });

    it("should accept 'pending' status", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockDoc = {
        exists: true,
        id: mockContactId,
        data: () => ({ ...mockContactData, touchpointStatus: "pending" }),
      };
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({
          update: mockUpdate,
          get: mockGet,
        }),
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

      const req = new Request("http://localhost/api/contacts/contact123/touchpoint-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });

      const params = Promise.resolve({ contactId: mockContactId });
      const response = await PATCH(req, { params });

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("should accept 'completed' status", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockDoc = {
        exists: true,
        id: mockContactId,
        data: () => ({ ...mockContactData, touchpointStatus: "completed" }),
      };
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({
          update: mockUpdate,
          get: mockGet,
        }),
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

      const req = new Request("http://localhost/api/contacts/contact123/touchpoint-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      const params = Promise.resolve({ contactId: mockContactId });
      const response = await PATCH(req, { params });

      expect(response.status).toBe(200);
    });

    it("should accept 'cancelled' status", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockDoc = {
        exists: true,
        id: mockContactId,
        data: () => ({ ...mockContactData, touchpointStatus: "cancelled" }),
      };
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({
          update: mockUpdate,
          get: mockGet,
        }),
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

      const req = new Request("http://localhost/api/contacts/contact123/touchpoint-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      const params = Promise.resolve({ contactId: mockContactId });
      const response = await PATCH(req, { params });

      expect(response.status).toBe(200);
    });
  });

  describe("Status update functionality", () => {
    it("should update touchpoint status to pending", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockDoc = {
        exists: true,
        id: mockContactId,
        data: () => ({ ...mockContactData, touchpointStatus: "pending" }),
      };
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({
          update: mockUpdate,
          get: mockGet,
        }),
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

      const req = new Request("http://localhost/api/contacts/contact123/touchpoint-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });

      const params = Promise.resolve({ contactId: mockContactId });
      const response = await PATCH(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.contact).toBeDefined();
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          touchpointStatus: "pending",
          touchpointStatusUpdatedAt: expect.anything(),
        })
      );
    });

    it("should update touchpoint status with reason", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockDoc = {
        exists: true,
        id: mockContactId,
        data: () => ({
          ...mockContactData,
          touchpointStatus: "completed",
          touchpointStatusReason: "Follow-up completed",
        }),
      };
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({
          update: mockUpdate,
          get: mockGet,
        }),
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

      const req = new Request("http://localhost/api/contacts/contact123/touchpoint-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", reason: "Follow-up completed" }),
      });

      const params = Promise.resolve({ contactId: mockContactId });
      const response = await PATCH(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          touchpointStatus: "completed",
          touchpointStatusReason: "Follow-up completed",
        })
      );
    });

    it("should clear status when status is null", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockDoc = {
        exists: true,
        id: mockContactId,
        data: () => ({
          ...mockContactData,
          touchpointStatus: null,
          touchpointStatusUpdatedAt: null,
          touchpointStatusReason: null,
        }),
      };
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({
          update: mockUpdate,
          get: mockGet,
        }),
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

      const req = new Request("http://localhost/api/contacts/contact123/touchpoint-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: null }),
      });

      const params = Promise.resolve({ contactId: mockContactId });
      const response = await PATCH(req, { params });

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          touchpointStatus: null,
          touchpointStatusUpdatedAt: null,
          touchpointStatusReason: null,
        })
      );
    });

    it("should set reason to null when empty string is provided", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockDoc = {
        exists: true,
        id: mockContactId,
        data: () => ({
          ...mockContactData,
          touchpointStatus: "completed",
          touchpointStatusReason: null,
        }),
      };
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({
          update: mockUpdate,
          get: mockGet,
        }),
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

      const req = new Request("http://localhost/api/contacts/contact123/touchpoint-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", reason: "" }),
      });

      const params = Promise.resolve({ contactId: mockContactId });
      await PATCH(req, { params });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          touchpointStatusReason: null,
        })
      );
    });

    it("should not update reason when reason is undefined", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockDoc = {
        exists: true,
        id: mockContactId,
        data: () => ({
          ...mockContactData,
          touchpointStatus: "completed",
        }),
      };
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({
          update: mockUpdate,
          get: mockGet,
        }),
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

      const req = new Request("http://localhost/api/contacts/contact123/touchpoint-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      const params = Promise.resolve({ contactId: mockContactId });
      await PATCH(req, { params });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.not.objectContaining({
          touchpointStatusReason: expect.anything(),
        })
      );
    });
  });

  describe("Error handling", () => {
    it("should return 404 when contact not found after update", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockDoc = {
        exists: false,
      };
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({
          update: mockUpdate,
          get: mockGet,
        }),
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

      const req = new Request("http://localhost/api/contacts/contact123/touchpoint-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });

      const params = Promise.resolve({ contactId: mockContactId });
      const response = await PATCH(req, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Contact not found");
    });

    it("should return 500 on unexpected errors", async () => {
      const mockUpdate = jest.fn().mockRejectedValue(new Error("Database error"));
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({
          update: mockUpdate,
        }),
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

      const req = new Request("http://localhost/api/contacts/contact123/touchpoint-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });

      const params = Promise.resolve({ contactId: mockContactId });
      const response = await PATCH(req, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe("Cache invalidation", () => {
    it("should invalidate cache tags on success", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockDoc = {
        exists: true,
        id: mockContactId,
        data: () => ({ ...mockContactData, touchpointStatus: "pending" }),
      };
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({
          update: mockUpdate,
          get: mockGet,
        }),
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

      const req = new Request("http://localhost/api/contacts/contact123/touchpoint-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });

      const params = Promise.resolve({ contactId: mockContactId });
      await PATCH(req, { params });

      expect(mockRevalidateTag).toHaveBeenCalledWith("contacts", "max");
      expect(mockRevalidateTag).toHaveBeenCalledWith(`contacts-${mockUserId}`, "max");
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `contact-${mockUserId}-${mockContactId}`,
        "max"
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(`dashboard-stats-${mockUserId}`, "max");
    });
  });

  describe("Response format", () => {
    it("should return updated contact in response", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const updatedContactData = {
        ...mockContactData,
        touchpointStatus: "completed",
        touchpointStatusUpdatedAt: new Date(),
      };
      const mockDoc = {
        exists: true,
        id: mockContactId,
        data: () => updatedContactData,
      };
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({
          update: mockUpdate,
          get: mockGet,
        }),
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

      const req = new Request("http://localhost/api/contacts/contact123/touchpoint-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      const params = Promise.resolve({ contactId: mockContactId });
      const response = await PATCH(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.contact).toBeDefined();
      expect(data.contact.contactId).toBe(mockContactId);
    });

    it("should convert timestamps in response", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockTimestamp = { seconds: 1234567890, nanoseconds: 0 };
      const mockDoc = {
        exists: true,
        id: mockContactId,
        data: () => ({
          ...mockContactData,
          touchpointStatus: "pending",
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          touchpointStatusUpdatedAt: mockTimestamp,
        }),
      };
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({
          update: mockUpdate,
          get: mockGet,
        }),
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
      mockConvertTimestamp.mockReturnValue(new Date(1234567890000));

      const req = new Request("http://localhost/api/contacts/contact123/touchpoint-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });

      const params = Promise.resolve({ contactId: mockContactId });
      await PATCH(req, { params });

      expect(mockConvertTimestamp).toHaveBeenCalled();
    });
  });

  describe("URL parameter handling", () => {
    it("should decode contactId from URL", async () => {
      const encodedContactId = encodeURIComponent("contact@example.com");
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockDoc = {
        exists: true,
        id: "contact@example.com",
        data: () => ({ ...mockContactData, contactId: "contact@example.com" }),
      };
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockContactsCollection = {
        doc: jest.fn().mockReturnValue({
          update: mockUpdate,
          get: mockGet,
        }),
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

      const req = new Request(`http://localhost/api/contacts/${encodedContactId}/touchpoint-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });

      const params = Promise.resolve({ contactId: encodedContactId });
      await PATCH(req, { params });

      expect(mockContactsCollection.doc).toHaveBeenCalledWith("contact@example.com");
    });
  });
});
