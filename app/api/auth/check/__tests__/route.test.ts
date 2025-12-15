// Mock dependencies before importing route
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {},
}));
jest.mock("@/lib/auth-utils");
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

const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;

describe("GET /api/auth/check", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return authenticated: true when user is authenticated", async () => {
    mockGetUserId.mockResolvedValue("user123");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.authenticated).toBe(true);
    expect(mockGetUserId).toHaveBeenCalledTimes(1);
  });

  it("should return authenticated: false with 401 when user is not authenticated", async () => {
    mockGetUserId.mockRejectedValue(new Error("Not authenticated"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.authenticated).toBe(false);
    expect(mockGetUserId).toHaveBeenCalledTimes(1);
  });
});
