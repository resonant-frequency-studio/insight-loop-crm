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

import { POST } from "../route";
import { getUserId } from "@/lib/auth-utils";
import { importActionItemsFromText } from "@/lib/action-items";

const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;
const mockImportActionItemsFromText = importActionItemsFromText as jest.MockedFunction<
  typeof importActionItemsFromText
>;

describe("POST /api/action-items/import-from-text", () => {
  const mockUserId = "user123";
  const mockContactId = "contact123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(mockUserId);
  });

  describe("Input validation", () => {
    it("should return 400 if contactId is missing", async () => {
      const req = new Request("http://localhost/api/action-items/import-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionItemsText: "Action item 1\nAction item 2" }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("contactId is required");
      expect(mockImportActionItemsFromText).not.toHaveBeenCalled();
    });

    it("should return 400 if actionItemsText is missing", async () => {
      const req = new Request("http://localhost/api/action-items/import-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: mockContactId }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("actionItemsText is required and must be a string");
      expect(mockImportActionItemsFromText).not.toHaveBeenCalled();
    });

    it("should return 400 if actionItemsText is not a string", async () => {
      const req = new Request("http://localhost/api/action-items/import-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: mockContactId, actionItemsText: 123 }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("actionItemsText is required and must be a string");
      expect(mockImportActionItemsFromText).not.toHaveBeenCalled();
    });

    it("should return 400 if actionItemsText is empty string", async () => {
      const req = new Request("http://localhost/api/action-items/import-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: mockContactId, actionItemsText: "" }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("actionItemsText is required and must be a string");
      expect(mockImportActionItemsFromText).not.toHaveBeenCalled();
    });
  });

  describe("Import functionality", () => {
    it("should import action items successfully", async () => {
      const mockActionItemIds = ["action1", "action2", "action3"];
      mockImportActionItemsFromText.mockResolvedValue(mockActionItemIds);

      const req = new Request("http://localhost/api/action-items/import-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: mockContactId,
          actionItemsText: "Action item 1\nAction item 2\nAction item 3",
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.createdCount).toBe(3);
      expect(data.actionItemIds).toEqual(mockActionItemIds);
      expect(mockImportActionItemsFromText).toHaveBeenCalledWith(
        mockUserId,
        mockContactId,
        "Action item 1\nAction item 2\nAction item 3"
      );
    });

    it("should return empty array when no action items are created", async () => {
      mockImportActionItemsFromText.mockResolvedValue([]);

      const req = new Request("http://localhost/api/action-items/import-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: mockContactId,
          actionItemsText: "   \n\n   ",
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.createdCount).toBe(0);
      expect(data.actionItemIds).toEqual([]);
    });

    it("should handle single action item", async () => {
      const mockActionItemIds = ["action1"];
      mockImportActionItemsFromText.mockResolvedValue(mockActionItemIds);

      const req = new Request("http://localhost/api/action-items/import-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: mockContactId,
          actionItemsText: "Single action item",
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.createdCount).toBe(1);
      expect(data.actionItemIds).toEqual(["action1"]);
    });

    it("should pass through the actionItemsText exactly as provided", async () => {
      const mockActionItemIds = ["action1"];
      mockImportActionItemsFromText.mockResolvedValue(mockActionItemIds);

      const actionItemsText = "  Item with spaces  \n\nEmpty line\nItem 2  ";
      const req = new Request("http://localhost/api/action-items/import-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: mockContactId,
          actionItemsText,
        }),
      });

      await POST(req);

      expect(mockImportActionItemsFromText).toHaveBeenCalledWith(
        mockUserId,
        mockContactId,
        actionItemsText
      );
    });
  });

  describe("Error handling", () => {
    it("should return 500 on import errors", async () => {
      mockImportActionItemsFromText.mockRejectedValue(new Error("Import failed"));

      const req = new Request("http://localhost/api/action-items/import-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: mockContactId,
          actionItemsText: "Action item",
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Import failed");
    });

    it("should return 500 on auth errors", async () => {
      mockGetUserId.mockRejectedValueOnce(new Error("Auth failed"));

      const req = new Request("http://localhost/api/action-items/import-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: mockContactId,
          actionItemsText: "Action item",
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it("should handle unknown error types", async () => {
      mockImportActionItemsFromText.mockRejectedValue("String error");

      const req = new Request("http://localhost/api/action-items/import-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: mockContactId,
          actionItemsText: "Action item",
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Unknown error");
    });
  });
});
