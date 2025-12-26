// Mock dependencies before importing route
jest.mock("@/lib/auth-utils");
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn(),
  },
}));
jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
  ErrorLevel: {
    ERROR: "error",
    WARNING: "warning",
    INFO: "info",
  },
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
import { adminDb } from "@/lib/firebase-admin";
import { Contact } from "@/types/firestore";

const mockGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;
const mockAdminDb = adminDb as jest.Mocked<typeof adminDb>;

// Type for search result contact (matches what the API returns)
interface SearchResultContact {
  contactId: string;
  firstName: string | null;
  lastName: string | null;
  primaryEmail: string;
  secondaryEmails?: string[];
  photoUrl: string | null;
}

describe("GET /api/contacts/search", () => {
  const mockUserId = "user123";

  const mockContacts: Contact[] = [
    {
      contactId: "contact1",
      primaryEmail: "john.doe@example.com",
      firstName: "John",
      lastName: "Doe",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      contactId: "contact2",
      primaryEmail: "jane.smith@company.com",
      firstName: "Jane",
      lastName: "Smith",
      archived: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      contactId: "contact3",
      primaryEmail: "bob@company.com",
      firstName: "Bob",
      lastName: "Johnson",
      archived: true, // Archived contact
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(mockUserId);
  });

  it("should return search results matching query", async () => {
    const mockSnapshot = {
      docs: mockContacts.map((contact) => ({
        id: contact.contactId,
        data: () => contact,
      })),
    };

    const mockContactsCollection = {
      get: jest.fn().mockResolvedValue(mockSnapshot),
    };

    const mockDoc = {
      collection: jest.fn().mockReturnValue(mockContactsCollection),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
    };

    mockAdminDb.collection = jest.fn().mockReturnValue(mockUsersCollection);

    const request = new Request("http://localhost?q=john");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.contacts).toBeDefined();
    expect(Array.isArray(data.contacts)).toBe(true);
    expect(data.count).toBeGreaterThan(0);
  });

  it("should search by firstName", async () => {
    const mockSnapshot = {
      docs: mockContacts.map((contact) => ({
        id: contact.contactId,
        data: () => contact,
      })),
    };

    const mockContactsCollection = {
      get: jest.fn().mockResolvedValue(mockSnapshot),
    };

    const mockDoc = {
      collection: jest.fn().mockReturnValue(mockContactsCollection),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
    };

    mockAdminDb.collection = jest.fn().mockReturnValue(mockUsersCollection);

    const request = new Request("http://localhost?q=Jane");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.contacts.length).toBeGreaterThan(0);
    expect(data.contacts.some((c: SearchResultContact) => c.firstName === "Jane")).toBe(true);
  });

  it("should search by lastName", async () => {
    const mockSnapshot = {
      docs: mockContacts.map((contact) => ({
        id: contact.contactId,
        data: () => contact,
      })),
    };

    const mockContactsCollection = {
      get: jest.fn().mockResolvedValue(mockSnapshot),
    };

    const mockDoc = {
      collection: jest.fn().mockReturnValue(mockContactsCollection),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
    };

    mockAdminDb.collection = jest.fn().mockReturnValue(mockUsersCollection);

    const request = new Request("http://localhost?q=Smith");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.contacts.length).toBeGreaterThan(0);
    expect(data.contacts.some((c: SearchResultContact) => c.lastName === "Smith")).toBe(true);
  });

  it("should search by primaryEmail", async () => {
    const mockSnapshot = {
      docs: mockContacts.map((contact) => ({
        id: contact.contactId,
        data: () => contact,
      })),
    };

    const mockContactsCollection = {
      get: jest.fn().mockResolvedValue(mockSnapshot),
    };

    const mockDoc = {
      collection: jest.fn().mockReturnValue(mockContactsCollection),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
    };

    mockAdminDb.collection = jest.fn().mockReturnValue(mockUsersCollection);

    const request = new Request("http://localhost?q=john.doe@example.com");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.contacts.length).toBeGreaterThan(0);
    expect(
      data.contacts.some((c: SearchResultContact) => c.primaryEmail === "john.doe@example.com")
    ).toBe(true);
  });

  it("should exclude archived contacts", async () => {
    const mockSnapshot = {
      docs: mockContacts.map((contact) => ({
        id: contact.contactId,
        data: () => contact,
      })),
    };

    const mockContactsCollection = {
      get: jest.fn().mockResolvedValue(mockSnapshot),
    };

    const mockDoc = {
      collection: jest.fn().mockReturnValue(mockContactsCollection),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
    };

    mockAdminDb.collection = jest.fn().mockReturnValue(mockUsersCollection);

    const request = new Request("http://localhost?q=bob");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Archived contact should be excluded
    expect(data.contacts.some((c: SearchResultContact) => c.contactId === "contact3")).toBe(false);
  });

  it("should exclude current contact if excludeContactId provided", async () => {
    const mockSnapshot = {
      docs: mockContacts.map((contact) => ({
        id: contact.contactId,
        data: () => contact,
      })),
    };

    const mockContactsCollection = {
      get: jest.fn().mockResolvedValue(mockSnapshot),
    };

    const mockDoc = {
      collection: jest.fn().mockReturnValue(mockContactsCollection),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
    };

    mockAdminDb.collection = jest.fn().mockReturnValue(mockUsersCollection);

    const request = new Request(
      "http://localhost?q=john&excludeContactId=contact1"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.contacts.some((c: SearchResultContact) => c.contactId === "contact1")).toBe(false);
  });

  it("should return limited results (20 max)", async () => {
    // Create 25 mock contacts
    const manyContacts = Array.from({ length: 25 }, (_, i) => ({
      contactId: `contact${i}`,
      primaryEmail: `contact${i}@example.com`,
      firstName: `Contact${i}`,
      lastName: "Test",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    }));

    const mockSnapshot = {
      docs: manyContacts.map((contact) => ({
        id: contact.contactId,
        data: () => contact,
      })),
    };

    const mockContactsCollection = {
      get: jest.fn().mockResolvedValue(mockSnapshot),
    };

    const mockDoc = {
      collection: jest.fn().mockReturnValue(mockContactsCollection),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
    };

    mockAdminDb.collection = jest.fn().mockReturnValue(mockUsersCollection);

    const request = new Request("http://localhost?q=contact");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.contacts.length).toBeLessThanOrEqual(20);
  });

  it("should return 400 for missing query parameter", async () => {
    const request = new Request("http://localhost");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("q");
  });

  it("should return 400 for empty query parameter", async () => {
    const request = new Request("http://localhost?q=");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("q");
  });

  it("should handle empty search results", async () => {
    const mockSnapshot = {
      docs: [],
    };

    const mockContactsCollection = {
      get: jest.fn().mockResolvedValue(mockSnapshot),
    };

    const mockDoc = {
      collection: jest.fn().mockReturnValue(mockContactsCollection),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
    };

    mockAdminDb.collection = jest.fn().mockReturnValue(mockUsersCollection);

    const request = new Request("http://localhost?q=nonexistent");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.contacts).toEqual([]);
    expect(data.count).toBe(0);
  });

  it("should perform case-insensitive search", async () => {
    const mockSnapshot = {
      docs: mockContacts.map((contact) => ({
        id: contact.contactId,
        data: () => contact,
      })),
    };

    const mockContactsCollection = {
      get: jest.fn().mockResolvedValue(mockSnapshot),
    };

    const mockDoc = {
      collection: jest.fn().mockReturnValue(mockContactsCollection),
    };

    const mockUsersCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
    };

    mockAdminDb.collection = jest.fn().mockReturnValue(mockUsersCollection);

    const request = new Request("http://localhost?q=JOHN");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.contacts.length).toBeGreaterThan(0);
  });
});

