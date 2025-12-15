// Mock dependencies before importing route
jest.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    createSessionCookie: jest.fn(),
  },
}));

interface MockResponse {
  json: () => Promise<unknown>;
  status: number;
  ok: boolean;
  cookies: {
    set: jest.Mock;
  };
}

jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body, init) => {
      const mockResponse: MockResponse = {
        json: async () => body,
        status: init?.status || 200,
        ok: (init?.status || 200) >= 200 && (init?.status || 200) < 300,
        cookies: {
          set: jest.fn(),
        },
      };
      return mockResponse;
    }),
  },
}));

import { POST, DELETE } from "../route";
import { adminAuth } from "@/lib/firebase-admin";

const mockAdminAuth = adminAuth as jest.Mocked<typeof adminAuth>;

describe("POST /api/auth/session", () => {
  const mockSessionCookie = "mock-session-cookie-value";

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminAuth.createSessionCookie.mockResolvedValue(mockSessionCookie);
    // Use Object.defineProperty to make NODE_ENV writable in tests
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "test",
      writable: true,
      configurable: true,
    });
  });

  describe("Input validation", () => {
    it("should return 400 if idToken is missing", async () => {
      const req = new Request("http://localhost/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Missing ID token");
      expect(mockAdminAuth.createSessionCookie).not.toHaveBeenCalled();
    });

    it("should return 400 if idToken is null", async () => {
      const req = new Request("http://localhost/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: null }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Missing ID token");
    });
  });

  describe("Session creation", () => {
    it("should create session cookie successfully", async () => {
      const mockIdToken = "mock-id-token";
      const req = new Request("http://localhost/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: mockIdToken }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(mockAdminAuth.createSessionCookie).toHaveBeenCalledWith(mockIdToken, {
        expiresIn: 5 * 24 * 60 * 60 * 1000, // 5 days in milliseconds
      });
    });

    it("should set cookie with correct properties in test/development", async () => {
      Object.defineProperty(process.env, "NODE_ENV", {
        value: "test",
        writable: true,
        configurable: true,
      });
      const mockIdToken = "mock-id-token";
      const req = new Request("http://localhost/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: mockIdToken }),
      });

      const response = (await POST(req)) as unknown as MockResponse;
      const setCookieSpy = response.cookies.set;

      expect(setCookieSpy).toHaveBeenCalledWith({
        name: "__session",
        value: mockSessionCookie,
        httpOnly: true,
        maxAge: 5 * 24 * 60 * 60, // 5 days in seconds
        path: "/",
        sameSite: "lax",
        secure: false, // false in test mode
      });
    });

    it("should set cookie with secure flag in production", async () => {
      Object.defineProperty(process.env, "NODE_ENV", {
        value: "production",
        writable: true,
        configurable: true,
      });
      const mockIdToken = "mock-id-token";
      const req = new Request("http://localhost/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: mockIdToken }),
      });

      const response = (await POST(req)) as unknown as MockResponse;
      const setCookieSpy = response.cookies.set;

      expect(setCookieSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          secure: true, // true in production
        })
      );
    });

    it("should set cookie expiration to 5 days", async () => {
      const mockIdToken = "mock-id-token";
      const req = new Request("http://localhost/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: mockIdToken }),
      });

      await POST(req);

      expect(mockAdminAuth.createSessionCookie).toHaveBeenCalledWith(mockIdToken, {
        expiresIn: 5 * 24 * 60 * 60 * 1000, // 5 days
      });
    });
  });

  describe("Error handling", () => {
    it("should handle createSessionCookie errors", async () => {
      mockAdminAuth.createSessionCookie.mockRejectedValue(new Error("Invalid token"));

      const req = new Request("http://localhost/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: "invalid-token" }),
      });

      await expect(POST(req)).rejects.toThrow("Invalid token");
    });
  });
});

describe("DELETE /api/auth/session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "test",
      writable: true,
      configurable: true,
    });
  });

  it("should clear session cookie successfully", async () => {
    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it("should set cookie to empty with maxAge 0", async () => {
    const response = (await DELETE()) as unknown as MockResponse;
    const setCookieSpy = response.cookies.set;

    expect(setCookieSpy).toHaveBeenCalledWith({
      name: "__session",
      value: "",
      httpOnly: true,
      maxAge: 0,
      path: "/",
      secure: false, // false in test mode
    });
  });

  it("should set secure flag in production", async () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      writable: true,
      configurable: true,
    });
    const response = (await DELETE()) as unknown as MockResponse;
    const setCookieSpy = response.cookies.set;

    expect(setCookieSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        secure: true, // true in production
      })
    );
  });

  it("should not set secure flag in development/test", async () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "development",
      writable: true,
      configurable: true,
    });
    const response = (await DELETE()) as unknown as MockResponse;
    const setCookieSpy = response.cookies.set;

    expect(setCookieSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        secure: false,
      })
    );
  });
});
