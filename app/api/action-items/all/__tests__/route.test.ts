// Mock dependencies before importing route
jest.mock("@/lib/auth-utils");
jest.mock("@/lib/action-items");
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {},
}));
jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
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

import { GET } from "../route";
import { getUserId } from "@/lib/auth-utils";
import { getAllActionItemsForUser } from "@/lib/action-items";

const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;
const mockGetAllActionItemsForUser = getAllActionItemsForUser as jest.MockedFunction<
  typeof getAllActionItemsForUser
>;

describe("GET /api/action-items/all", () => {
  const mockUserId = "user123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(mockUserId);
    // Reset NODE_ENV to test
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Successful requests", () => {
    it("should return action items successfully", async () => {
      const mockActionItems = [
        {
          actionItemId: "action1",
          contactId: "contact1",
          userId: mockUserId,
          text: "Follow up with client",
          status: "pending" as const,
          contactFirstName: "John",
          contactLastName: "Doe",
          contactEmail: "john@example.com",
        },
        {
          actionItemId: "action2",
          contactId: "contact2",
          userId: mockUserId,
          text: "Send proposal",
          status: "completed" as const,
          contactFirstName: "Jane",
          contactLastName: "Smith",
          contactEmail: "jane@example.com",
        },
      ];
      mockGetAllActionItemsForUser.mockResolvedValue(mockActionItems);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.actionItems).toEqual(mockActionItems);
      expect(mockGetAllActionItemsForUser).toHaveBeenCalledWith(mockUserId);
    });

    it("should return empty array when no action items exist", async () => {
      mockGetAllActionItemsForUser.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.actionItems).toEqual([]);
      expect(mockGetAllActionItemsForUser).toHaveBeenCalledWith(mockUserId);
    });

    it("should include debug info in development mode", async () => {
      process.env.NODE_ENV = "development";
      const mockActionItems = [
        {
          actionItemId: "action1",
          contactId: "contact1",
          userId: mockUserId,
          text: "Follow up",
          status: "pending" as const,
        },
      ];
      mockGetAllActionItemsForUser.mockResolvedValue(mockActionItems);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.actionItems).toEqual(mockActionItems);
      expect(data.debug).toBeDefined();
      expect(data.debug?.count).toBe(1);
      expect(data.debug?.userId).toBe(mockUserId);
    });

    it("should not include debug info in production mode", async () => {
      process.env.NODE_ENV = "production";
      const mockActionItems = [
        {
          actionItemId: "action1",
          contactId: "contact1",
          userId: mockUserId,
          text: "Follow up",
          status: "pending" as const,
        },
      ];
      mockGetAllActionItemsForUser.mockResolvedValue(mockActionItems);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.actionItems).toEqual(mockActionItems);
      expect(data.debug).toBeUndefined();
    });

    it("should not include debug info in test mode", async () => {
      process.env.NODE_ENV = "test";
      const mockActionItems = [
        {
          actionItemId: "action1",
          contactId: "contact1",
          userId: mockUserId,
          text: "Follow up",
          status: "pending" as const,
        },
      ];
      mockGetAllActionItemsForUser.mockResolvedValue(mockActionItems);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.actionItems).toEqual(mockActionItems);
      expect(data.debug).toBeUndefined();
    });
  });

  describe("Error handling", () => {
    it("should return 500 on unexpected errors", async () => {
      mockGetAllActionItemsForUser.mockRejectedValue(new Error("Database error"));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Database error");
    });

    it("should return 429 when quota is exceeded (RESOURCE_EXHAUSTED)", async () => {
      const quotaError = new Error("RESOURCE_EXHAUSTED: Quota exceeded");
      mockGetAllActionItemsForUser.mockRejectedValue(quotaError);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain("Database quota exceeded");
      expect(data.quotaExceeded).toBe(true);
    });

    it("should return 429 when quota is exceeded (Quota exceeded)", async () => {
      const quotaError = new Error("Quota exceeded");
      mockGetAllActionItemsForUser.mockRejectedValue(quotaError);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain("Database quota exceeded");
      expect(data.quotaExceeded).toBe(true);
    });

    it("should return 500 on auth errors", async () => {
      mockGetUserId.mockRejectedValueOnce(new Error("Auth failed"));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it("should handle unknown error types", async () => {
      mockGetAllActionItemsForUser.mockRejectedValue("String error");

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Unknown error");
    });
  });
});
