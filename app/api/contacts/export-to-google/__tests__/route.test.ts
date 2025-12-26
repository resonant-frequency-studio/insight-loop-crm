// Mock Firebase Admin before any imports
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {},
  adminAuth: {},
}));

// Mock NextResponse and NextRequest
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      json: async () => body,
      status: init?.status || 200,
      ok: (init?.status || 200) >= 200 && (init?.status || 200) < 300,
    })),
  },
  NextRequest: class extends Request {
    // NextRequest extends Request, so we can use Request as a base
  },
}));

// Mock dependencies
jest.mock("@/lib/google-contacts/export-contacts-runner");
jest.mock("@/lib/auth-utils");
jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
}));

import { POST } from "../route";
import { runExportJob } from "@/lib/google-contacts/export-contacts-runner";
import { getUserId } from "@/lib/auth-utils";
import { reportException } from "@/lib/error-reporting";
import { NextRequest } from "next/server";

const mockRunExportJob = runExportJob as jest.MockedFunction<typeof runExportJob>;
const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;
const mockReportException = reportException as jest.MockedFunction<typeof reportException>;

describe("POST /api/contacts/export-to-google", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue("user123");
  });

  it("should return exportJobId immediately after starting job", async () => {
    // Mock runExportJob to resolve (but we won't await it in the route)
    mockRunExportJob.mockResolvedValue(undefined);

    const request = new Request("http://localhost:3000/api/contacts/export-to-google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactIds: ["contact1", "contact2"],
        groupId: "group123",
      }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.exportJobId).toBeDefined();
    expect(data.exportJobId).toMatch(/^export_\d+_[a-z0-9]+$/);
  });

  it("should start export job with correct parameters", async () => {
    mockRunExportJob.mockResolvedValue(undefined);

    const request = new Request("http://localhost:3000/api/contacts/export-to-google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactIds: ["contact1", "contact2"],
        groupId: "group123",
      }),
    }) as NextRequest;

    await POST(request);

    await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay to allow async call

    expect(mockRunExportJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user123",
        contactIds: ["contact1", "contact2"],
        groupId: "group123",
        exportJobId: expect.stringMatching(/^export_\d+_[a-z0-9]+$/),
      })
    );
  });

  it("should handle groupName instead of groupId", async () => {
    mockRunExportJob.mockResolvedValue(undefined);

    const request = new Request("http://localhost:3000/api/contacts/export-to-google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactIds: ["contact1"],
        groupName: "New Group",
      }),
    }) as NextRequest;

    await POST(request);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockRunExportJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user123",
        contactIds: ["contact1"],
        groupName: "New Group",
        exportJobId: expect.any(String),
      })
    );
  });

  it("should return 400 if contactIds is missing", async () => {
    const request = new Request("http://localhost:3000/api/contacts/export-to-google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("contactIds");
    expect(mockRunExportJob).not.toHaveBeenCalled();
  });

  it("should return 400 if contactIds is empty array", async () => {
    const request = new Request("http://localhost:3000/api/contacts/export-to-google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactIds: [],
      }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("contactIds");
    expect(mockRunExportJob).not.toHaveBeenCalled();
  });

  it("should return 400 if contactIds is not an array", async () => {
    const request = new Request("http://localhost:3000/api/contacts/export-to-google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactIds: "not-an-array",
      }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("contactIds");
    expect(mockRunExportJob).not.toHaveBeenCalled();
  });

  it("should handle errors from runExportJob gracefully", async () => {
    const error = new Error("Export failed");
    mockRunExportJob.mockRejectedValue(error);

    const request = new Request("http://localhost:3000/api/contacts/export-to-google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactIds: ["contact1"],
        groupId: "group123",
      }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    // Should still return 200 with jobId (fire-and-forget pattern)
    expect(response.status).toBe(200);
    expect(data.exportJobId).toBeDefined();

    // Error should be logged
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockReportException).toHaveBeenCalled();
  });

  it("should return 500 if getUserId fails", async () => {
    mockGetUserId.mockRejectedValue(new Error("Auth failed"));

    const request = new Request("http://localhost:3000/api/contacts/export-to-google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactIds: ["contact1"],
      }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to start export");
    expect(mockRunExportJob).not.toHaveBeenCalled();
  });

  it("should allow export without group (contacts go to Other Contacts)", async () => {
    mockRunExportJob.mockResolvedValue(undefined);

    const request = new Request("http://localhost:3000/api/contacts/export-to-google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactIds: ["contact1", "contact2"],
      }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.exportJobId).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockRunExportJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user123",
        contactIds: ["contact1", "contact2"],
        groupId: undefined,
        groupName: undefined,
      })
    );
  });
});

