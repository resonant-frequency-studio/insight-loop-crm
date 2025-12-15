// Mock dependencies before importing route
jest.mock("@/lib/auth-utils");
jest.mock("@/lib/contacts-server");
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

import { GET, PATCH, DELETE } from "../route";
import { getUserId } from "@/lib/auth-utils";
import { getContactForUser } from "@/lib/contacts-server";
import { adminDb } from "@/lib/firebase-admin";
import { revalidateTag } from "next/cache";
import { convertTimestamp } from "@/util/timestamp-utils-server";

const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;
const mockGetContactForUser = getContactForUser as jest.MockedFunction<typeof getContactForUser>;
const mockRevalidateTag = revalidateTag as jest.MockedFunction<typeof revalidateTag>;
const mockConvertTimestamp = convertTimestamp as jest.MockedFunction<typeof convertTimestamp>;

describe("GET /api/contacts/[contactId]", () => {
  const mockUserId = "user123";
  const mockContactId = "contact123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(mockUserId);
    mockConvertTimestamp.mockImplementation((ts) => ts);
  });

  it("should return contact when found", async () => {
    const mockContact = {
      contactId: mockContactId,
      primaryEmail: "test@example.com",
      firstName: "Test",
      lastName: "User",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };
    mockGetContactForUser.mockResolvedValue(mockContact);

    const params = Promise.resolve({ contactId: mockContactId });
    const response = await GET(new Request("http://localhost"), { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.contact).toEqual(mockContact);
    expect(mockGetContactForUser).toHaveBeenCalledWith(mockUserId, mockContactId);
  });

  it("should return 404 when contact not found", async () => {
    mockGetContactForUser.mockResolvedValue(null);

    const params = Promise.resolve({ contactId: mockContactId });
    const response = await GET(new Request("http://localhost"), { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Contact not found");
  });

  it("should decode contactId from URL", async () => {
    const encodedContactId = encodeURIComponent("contact@example.com");
    const mockContact = {
      contactId: "contact@example.com",
      primaryEmail: "contact@example.com",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };
    mockGetContactForUser.mockResolvedValue(mockContact);

    const params = Promise.resolve({ contactId: encodedContactId });
    await GET(new Request("http://localhost"), { params });

    expect(mockGetContactForUser).toHaveBeenCalledWith(mockUserId, "contact@example.com");
  });

  it("should return 500 on unexpected errors", async () => {
    mockGetContactForUser.mockRejectedValue(new Error("Database error"));

    const params = Promise.resolve({ contactId: mockContactId });
    const response = await GET(new Request("http://localhost"), { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});

describe("PATCH /api/contacts/[contactId]", () => {
  const mockUserId = "user123";
  const mockContactId = "contact123";
  const mockExistingContact = {
    contactId: mockContactId,
    primaryEmail: "test@example.com",
    firstName: "Test",
    lastName: "User",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(mockUserId);
    mockGetContactForUser.mockResolvedValue(mockExistingContact);
    mockConvertTimestamp.mockImplementation((ts) => ts);
  });

  it("should update contact successfully", async () => {
    const mockUpdate = jest.fn().mockResolvedValue(undefined);
    const mockUpdatedData = {
      ...mockExistingContact,
      firstName: "Updated",
      updatedAt: new Date(),
    };
    const mockDoc = {
      exists: true,
      id: mockContactId,
      data: () => mockUpdatedData,
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

    const updates = { firstName: "Updated" };
    const req = new Request("http://localhost/api/contacts/contact123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const params = Promise.resolve({ contactId: mockContactId });
    const response = await PATCH(req, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.contact).toBeDefined();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Updated",
        updatedAt: expect.anything(),
      })
    );
    expect(mockGet).toHaveBeenCalled();
  });

  it("should return 404 when contact not found before update", async () => {
    mockGetContactForUser.mockResolvedValue(null);

    const updates = { firstName: "Updated" };
    const req = new Request("http://localhost/api/contacts/contact123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const params = Promise.resolve({ contactId: mockContactId });
    const response = await PATCH(req, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Contact not found");
  });

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

    const updates = { firstName: "Updated" };
    const req = new Request("http://localhost/api/contacts/contact123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const params = Promise.resolve({ contactId: mockContactId });
    const response = await PATCH(req, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Contact not found after update");
  });

  it("should invalidate cache tags on success", async () => {
    const mockUpdate = jest.fn().mockResolvedValue(undefined);
    const mockUpdatedData = {
      ...mockExistingContact,
      firstName: "Updated",
      updatedAt: new Date(),
    };
    const mockDoc = {
      exists: true,
      id: mockContactId,
      data: () => mockUpdatedData,
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

    const updates = { firstName: "Updated" };
    const req = new Request("http://localhost/api/contacts/contact123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
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

  it("should convert timestamps in response", async () => {
    const mockUpdate = jest.fn().mockResolvedValue(undefined);
    const mockTimestamp = { seconds: 1234567890, nanoseconds: 0 };
    const mockUpdatedData = {
      ...mockExistingContact,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
      lastEmailDate: mockTimestamp,
    };
    const mockDoc = {
      exists: true,
      id: mockContactId,
      data: () => mockUpdatedData,
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

    const updates = { firstName: "Updated" };
    const req = new Request("http://localhost/api/contacts/contact123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const params = Promise.resolve({ contactId: mockContactId });
    await PATCH(req, { params });

    expect(mockConvertTimestamp).toHaveBeenCalled();
  });

  it("should return 500 on unexpected errors", async () => {
    mockGetContactForUser.mockRejectedValue(new Error("Database error"));

    const updates = { firstName: "Updated" };
    const req = new Request("http://localhost/api/contacts/contact123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const params = Promise.resolve({ contactId: mockContactId });
    const response = await PATCH(req, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});

describe("DELETE /api/contacts/[contactId]", () => {
  const mockUserId = "user123";
  const mockContactId = "contact123";
  const mockExistingContact = {
    contactId: mockContactId,
    primaryEmail: "test@example.com",
    firstName: "Test",
    lastName: "User",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(mockUserId);
    mockGetContactForUser.mockResolvedValue(mockExistingContact);
    mockRevalidateTag.mockImplementation(() => {});
  });

  it("should delete contact successfully", async () => {
    const mockDelete = jest.fn().mockResolvedValue(undefined);
    const mockContactsCollection = {
      doc: jest.fn().mockReturnValue({ delete: mockDelete }),
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

    const req = new Request("http://localhost/api/contacts/contact123", {
      method: "DELETE",
    });

    const params = Promise.resolve({ contactId: mockContactId });
    const response = await DELETE(req, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("should return 404 when contact not found", async () => {
    mockGetContactForUser.mockResolvedValue(null);

    const req = new Request("http://localhost/api/contacts/contact123", {
      method: "DELETE",
    });

    const params = Promise.resolve({ contactId: mockContactId });
    const response = await DELETE(req, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Contact not found");
  });

  it("should decode contactId from URL", async () => {
    const encodedContactId = encodeURIComponent("contact@example.com");
    const mockDelete = jest.fn().mockResolvedValue(undefined);
    const mockContactsCollection = {
      doc: jest.fn().mockReturnValue({ delete: mockDelete }),
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
    mockGetContactForUser.mockResolvedValue({
      ...mockExistingContact,
      contactId: "contact@example.com",
    });

    const req = new Request(`http://localhost/api/contacts/${encodedContactId}`, {
      method: "DELETE",
    });

    const params = Promise.resolve({ contactId: encodedContactId });
    await DELETE(req, { params });

    expect(mockContactsCollection.doc).toHaveBeenCalledWith("contact@example.com");
  });

  it("should invalidate cache tags on success", async () => {
    const mockDelete = jest.fn().mockResolvedValue(undefined);
    const mockContactsCollection = {
      doc: jest.fn().mockReturnValue({ delete: mockDelete }),
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

    const req = new Request("http://localhost/api/contacts/contact123", {
      method: "DELETE",
    });

    const params = Promise.resolve({ contactId: mockContactId });
    await DELETE(req, { params });

    expect(mockRevalidateTag).toHaveBeenCalledWith("contacts", "max");
    expect(mockRevalidateTag).toHaveBeenCalledWith(`contacts-${mockUserId}`, "max");
    expect(mockRevalidateTag).toHaveBeenCalledWith(
      `contact-${mockUserId}-${mockContactId}`,
      "max"
    );
    expect(mockRevalidateTag).toHaveBeenCalledWith(`dashboard-stats-${mockUserId}`, "max");
  });

  it("should return 500 on unexpected errors", async () => {
    mockGetContactForUser.mockRejectedValue(new Error("Database error"));

    const req = new Request("http://localhost/api/contacts/contact123", {
      method: "DELETE",
    });

    const params = Promise.resolve({ contactId: mockContactId });
    const response = await DELETE(req, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it("should return 500 on delete errors", async () => {
    const mockDelete = jest.fn().mockRejectedValue(new Error("Delete failed"));
    const mockContactsCollection = {
      doc: jest.fn().mockReturnValue({ delete: mockDelete }),
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

    const req = new Request("http://localhost/api/contacts/contact123", {
      method: "DELETE",
    });

    const params = Promise.resolve({ contactId: mockContactId });
    const response = await DELETE(req, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
