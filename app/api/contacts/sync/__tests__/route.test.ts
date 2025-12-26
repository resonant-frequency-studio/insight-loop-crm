// Mock Firebase Admin before any imports
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {},
  adminAuth: {},
}));

// Mock NextResponse
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      json: async () => body,
      status: init?.status || 200,
      ok: (init?.status || 200) >= 200 && (init?.status || 200) < 300,
    })),
  },
}));

// Mock dependencies
jest.mock("@/lib/google-contacts/sync-job-runner");
jest.mock("@/lib/auth-utils");
jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
}));
jest.mock("@/lib/error-utils", () => ({
  toUserFriendlyError: jest.fn((err) => err instanceof Error ? err.message : String(err)),
}));

import { GET } from "../route";
import { runContactsSyncJob } from "@/lib/google-contacts/sync-job-runner";
import { getUserId } from "@/lib/auth-utils";
import { reportException } from "@/lib/error-reporting";

const mockRunContactsSyncJob = runContactsSyncJob as jest.MockedFunction<typeof runContactsSyncJob>;
const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;
const mockReportException = reportException as jest.MockedFunction<typeof reportException>;

describe("GET /api/contacts/sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue("user123");
  });

  it("should return syncJobId immediately after starting job", async () => {
    // Mock runContactsSyncJob to resolve (but we won't await it in the route)
    mockRunContactsSyncJob.mockResolvedValue({
      success: true,
      syncJobId: "contacts_sync_1234567890_abc123",
      processedContacts: 10,
      skippedContacts: 2,
    });

    const request = new Request("http://localhost:3000/api/contacts/sync");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.syncJobId).toBeDefined();
    expect(data.message).toContain("started");
    
    // Verify the job was started (even though we don't await it)
    // The syncJobId is generated in the route, so we just check it was called
    expect(mockRunContactsSyncJob).toHaveBeenCalledWith({
      userId: "user123",
      syncJobId: expect.any(String),
    });
  });

  it("should handle errors when starting job fails", async () => {
    const error = new Error("Failed to get access token");
    // The route catches errors in the background job, so it still returns success
    mockRunContactsSyncJob.mockRejectedValue(error);

    const request = new Request("http://localhost:3000/api/contacts/sync");
    const response = await GET(request);
    const data = await response.json();

    // Should still return 200 with syncJobId (fire-and-forget pattern)
    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.syncJobId).toBeDefined();
    
    // Give a small delay to allow the catch handler to run
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Error should be logged in the background
    expect(mockReportException).toHaveBeenCalled();
  });

  it("should return error if getUserId fails", async () => {
    const authError = new Error("Unauthorized");
    mockGetUserId.mockRejectedValue(authError);

    const request = new Request("http://localhost:3000/api/contacts/sync");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(data.error).toBeDefined();
    expect(mockReportException).toHaveBeenCalled();
  });

  it("should generate unique syncJobId for each request", async () => {
    mockRunContactsSyncJob.mockResolvedValue({
      success: true,
      syncJobId: "contacts_sync_1234567890_abc123",
      processedContacts: 5,
      skippedContacts: 1,
    });

    const request1 = new Request("http://localhost:3000/api/contacts/sync");
    const response1 = await GET(request1);
    const data1 = await response1.json();

    // Add small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 1));

    const request2 = new Request("http://localhost:3000/api/contacts/sync");
    const response2 = await GET(request2);
    const data2 = await response2.json();

    // Each request should get a different syncJobId (generated in route)
    expect(data1.syncJobId).toBeDefined();
    expect(data2.syncJobId).toBeDefined();
    expect(data1.syncJobId).not.toBe(data2.syncJobId);
    
    // Verify both jobs were started
    expect(mockRunContactsSyncJob).toHaveBeenCalledTimes(2);
  });
});

