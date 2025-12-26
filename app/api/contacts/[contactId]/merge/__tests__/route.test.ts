// Mock dependencies before importing route
jest.mock("@/lib/auth-utils");
jest.mock("@/lib/contacts-server");
jest.mock("@/lib/contacts/merge-contacts");
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {},
}));
jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
  ErrorLevel: {
    ERROR: "error",
    WARNING: "warning",
    INFO: "info",
  },
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
import { getContactForUser } from "@/lib/contacts-server";
import { mergeContacts } from "@/lib/contacts/merge-contacts";
import { revalidateTag } from "next/cache";

const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;
const mockGetContactForUser = getContactForUser as jest.MockedFunction<typeof getContactForUser>;
const mockMergeContacts = mergeContacts as jest.MockedFunction<typeof mergeContacts>;
const mockRevalidateTag = revalidateTag as jest.MockedFunction<typeof revalidateTag>;

describe("POST /api/contacts/[contactId]/merge", () => {
  const mockUserId = "user123";
  const mockPrimaryContactId = "contact1";
  const mockContactIdsToMerge = ["contact2", "contact3"];
  const mockPrimaryEmail = "primary@example.com";

  const mockPrimaryContact = {
    contactId: mockPrimaryContactId,
    primaryEmail: mockPrimaryEmail,
    firstName: "John",
    lastName: "Doe",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const mockContact2 = {
    contactId: "contact2",
    primaryEmail: "contact2@example.com",
    firstName: "Jane",
    lastName: "Smith",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(mockUserId);
  });

  it("should return 200 on successful merge", async () => {
    mockGetContactForUser
      .mockResolvedValueOnce(mockPrimaryContact)
      .mockResolvedValueOnce(mockContact2)
      .mockResolvedValueOnce({
        contactId: "contact3",
        primaryEmail: "contact3@example.com",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      });

    mockMergeContacts.mockResolvedValue({
      success: true,
      primaryContactId: mockPrimaryContactId,
      mergedContactIds: mockContactIdsToMerge,
      statistics: {
        actionItemsUpdated: 5,
        threadsUpdated: 3,
        calendarEventsUpdated: 2,
        actionItemsMoved: 5,
      },
    });

    const params = Promise.resolve({ contactId: mockPrimaryContactId });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        contactIdsToMerge: mockContactIdsToMerge,
        primaryEmail: mockPrimaryEmail,
      }),
    });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.primaryContactId).toBe(mockPrimaryContactId);
    expect(data.mergedContactIds).toEqual(mockContactIdsToMerge);
    expect(mockMergeContacts).toHaveBeenCalledWith(
      mockUserId,
      mockPrimaryContactId,
      mockContactIdsToMerge,
      mockPrimaryEmail
    );
    expect(mockRevalidateTag).toHaveBeenCalled();
  });

  it("should return 400 for invalid request body", async () => {
    const params = Promise.resolve({ contactId: mockPrimaryContactId });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        contactIdsToMerge: [], // Empty array
        primaryEmail: mockPrimaryEmail,
      }),
    });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("contactIdsToMerge");
  });

  it("should return 400 for missing primaryEmail", async () => {
    const params = Promise.resolve({ contactId: mockPrimaryContactId });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        contactIdsToMerge: mockContactIdsToMerge,
        primaryEmail: "", // Empty email
      }),
    });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("primaryEmail");
  });

  it("should return 400 when trying to merge contact into itself", async () => {
    const params = Promise.resolve({ contactId: mockPrimaryContactId });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        contactIdsToMerge: [mockPrimaryContactId], // Includes primary contact
        primaryEmail: mockPrimaryEmail,
      }),
    });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("itself");
  });

  it("should return 404 when primary contact not found", async () => {
    mockGetContactForUser.mockResolvedValue(null);

    const params = Promise.resolve({ contactId: mockPrimaryContactId });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        contactIdsToMerge: mockContactIdsToMerge,
        primaryEmail: mockPrimaryEmail,
      }),
    });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("not found");
  });

  it("should return 404 when contact to merge not found", async () => {
    mockGetContactForUser
      .mockResolvedValueOnce(mockPrimaryContact)
      .mockResolvedValueOnce(null); // Contact2 not found

    const params = Promise.resolve({ contactId: mockPrimaryContactId });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        contactIdsToMerge: mockContactIdsToMerge,
        primaryEmail: mockPrimaryEmail,
      }),
    });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("not found");
  });

  it("should return 500 when merge fails", async () => {
    mockGetContactForUser
      .mockResolvedValueOnce(mockPrimaryContact)
      .mockResolvedValueOnce(mockContact2)
      .mockResolvedValueOnce({
        contactId: "contact3",
        primaryEmail: "contact3@example.com",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      });

    mockMergeContacts.mockResolvedValue({
      success: false,
      primaryContactId: mockPrimaryContactId,
      mergedContactIds: mockContactIdsToMerge,
      statistics: {
        actionItemsUpdated: 0,
        threadsUpdated: 0,
        calendarEventsUpdated: 0,
        actionItemsMoved: 0,
      },
      error: "Merge failed",
    });

    const params = Promise.resolve({ contactId: mockPrimaryContactId });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        contactIdsToMerge: mockContactIdsToMerge,
        primaryEmail: mockPrimaryEmail,
      }),
    });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Merge failed");
  });

  it("should decode contactId from URL", async () => {
    const encodedContactId = encodeURIComponent("contact@example.com");
    mockGetContactForUser.mockResolvedValue(mockPrimaryContact);
    mockMergeContacts.mockResolvedValue({
      success: true,
      primaryContactId: "contact@example.com",
      mergedContactIds: mockContactIdsToMerge,
      statistics: {
        actionItemsUpdated: 0,
        threadsUpdated: 0,
        calendarEventsUpdated: 0,
        actionItemsMoved: 0,
      },
    });

    const params = Promise.resolve({ contactId: encodedContactId });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        contactIdsToMerge: mockContactIdsToMerge,
        primaryEmail: mockPrimaryEmail,
      }),
    });

    await POST(request, { params });

    expect(mockGetContactForUser).toHaveBeenCalledWith(mockUserId, "contact@example.com");
  });

  describe("Secondary Emails", () => {
    it("should handle merge with secondary emails in contact data", async () => {
      const mockPrimaryContactWithSecondary = {
        ...mockPrimaryContact,
        secondaryEmails: ["john.doe@example.com"],
      };
      const mockContact2WithSecondary = {
        ...mockContact2,
        secondaryEmails: ["jane.smith@example.com"],
      };

      mockGetContactForUser
        .mockResolvedValueOnce(mockPrimaryContactWithSecondary)
        .mockResolvedValueOnce(mockContact2WithSecondary);

      mockMergeContacts.mockResolvedValue({
        success: true,
        primaryContactId: mockPrimaryContactId,
        mergedContactIds: ["contact2"],
        statistics: {
          actionItemsUpdated: 0,
          threadsUpdated: 0,
          calendarEventsUpdated: 0,
          actionItemsMoved: 0,
        },
      });

      const params = Promise.resolve({ contactId: mockPrimaryContactId });
      const request = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          contactIdsToMerge: ["contact2"],
          primaryEmail: mockPrimaryEmail,
        }),
      });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockMergeContacts).toHaveBeenCalledWith(
        mockUserId,
        mockPrimaryContactId,
        ["contact2"],
        mockPrimaryEmail
      );
    });

    it("should validate primary email against all emails including secondary", async () => {
      const mockPrimaryContactWithSecondary = {
        ...mockPrimaryContact,
        secondaryEmails: ["better@example.com"],
      };

      mockGetContactForUser.mockResolvedValueOnce(mockPrimaryContactWithSecondary);

      const params = Promise.resolve({ contactId: mockPrimaryContactId });
      const request = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          contactIdsToMerge: ["contact2"],
          primaryEmail: "better@example.com", // From secondary emails
        }),
      });

      // Should allow selecting email from secondary emails as primary
      mockMergeContacts.mockResolvedValue({
        success: true,
        primaryContactId: mockPrimaryContactId,
        mergedContactIds: ["contact2"],
        statistics: {
          actionItemsUpdated: 0,
          threadsUpdated: 0,
          calendarEventsUpdated: 0,
          actionItemsMoved: 0,
        },
      });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

