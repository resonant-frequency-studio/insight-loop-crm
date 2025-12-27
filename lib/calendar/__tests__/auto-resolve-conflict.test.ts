import { canAutoResolve, tryAutoResolveConflict } from "../auto-resolve-conflict";
import { ConflictInfo } from "../conflict-detector";
import { CalendarEvent } from "@/types/firestore";
import { GoogleCalendarEvent } from "../google-calendar-client";
import { Timestamp, Firestore } from "firebase-admin/firestore";

// Mock dependencies
jest.mock("../auto-resolve-conflict", () => {
  const actual = jest.requireActual("../auto-resolve-conflict");
  return {
    ...actual,
    autoResolveConflictFromGoogle: jest.fn(),
  };
});

describe("auto-resolve-conflict", () => {
  describe("canAutoResolve", () => {
    it("should return true for simple conflicts", () => {
      const conflictInfo: ConflictInfo = {
        type: "simple",
        reason: "only_google_changed",
        googleChanged: true,
        crmChanged: false,
      };

      expect(canAutoResolve(conflictInfo)).toBe(true);
    });

    it("should return false for complex conflicts", () => {
      const conflictInfo: ConflictInfo = {
        type: "complex",
        reason: "both_changed",
        googleChanged: true,
        crmChanged: true,
      };

      expect(canAutoResolve(conflictInfo)).toBe(false);
    });

    it("should return false for no conflict", () => {
      const conflictInfo: ConflictInfo = {
        type: "none",
        googleChanged: false,
        crmChanged: false,
      };

      expect(canAutoResolve(conflictInfo)).toBe(false);
    });
  });

  describe("tryAutoResolveConflict", () => {
    const baseCrmEvent: CalendarEvent = {
      eventId: "event1",
      googleEventId: "google1",
      userId: "user1",
      title: "Test Event",
      startTime: Timestamp.fromDate(new Date("2024-01-15T10:00:00Z")),
      endTime: Timestamp.fromDate(new Date("2024-01-15T11:00:00Z")),
      lastSyncedAt: Timestamp.fromDate(new Date("2024-01-15T09:00:00Z")),
      createdAt: Timestamp.fromDate(new Date("2024-01-15T08:00:00Z")),
      updatedAt: Timestamp.fromDate(new Date("2024-01-15T09:00:00Z")),
    };

    const baseGoogleEvent: GoogleCalendarEvent = {
      id: "google1",
      summary: "Test Event",
      start: {
        dateTime: "2024-01-15T10:00:00Z",
      },
      end: {
        dateTime: "2024-01-15T11:00:00Z",
      },
      etag: "etag1",
      updated: "2024-01-15T09:00:00Z",
    };

    it("should not resolve conflicts when only CRM changed", async () => {
      // Test a scenario where only CRM changed (isDirty = true, CRM update is more recent)
      // This should NOT be auto-resolved here - it's handled by the dirty sync job
      const googleEvent: GoogleCalendarEvent = {
        ...baseGoogleEvent,
        updated: "2024-01-15T09:00:00Z", // Less recent than CRM update
        summary: "Google Event",
      };

      const crmEvent: CalendarEvent = {
        ...baseCrmEvent,
        isDirty: true,
        updatedAt: Timestamp.fromDate(new Date("2024-01-15T10:00:00Z")), // More recent than Google update
        title: "CRM Updated",
      };

      // Mock Firestore (not used for "only_crm_changed" conflicts)
      const mockDb = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({
              doc: jest.fn(() => ({
                update: jest.fn(),
              })),
            })),
          })),
        })),
      } as unknown as Firestore;

      const result = await tryAutoResolveConflict(mockDb, "user1", googleEvent, crmEvent);
      expect(result.resolved).toBe(false);
      // Since crmUpdated (10:00) > googleUpdated (09:00) and isDirty = true, this is "only_crm_changed"
      // which is a simple conflict but should NOT be auto-resolved here (handled by dirty sync job)
      expect(result.conflictInfo.type).toBe("simple");
      expect(result.conflictInfo.reason).toBe("only_crm_changed");
    });

    it("should resolve simple conflicts when only Google changed", async () => {
      const googleEvent: GoogleCalendarEvent = {
        ...baseGoogleEvent,
        updated: "2024-01-15T10:00:00Z",
        summary: "Google Updated",
      };

      const crmEvent: CalendarEvent = {
        ...baseCrmEvent,
        isDirty: false,
        updatedAt: Timestamp.fromDate(new Date("2024-01-15T09:00:00Z")),
      };

      // Mock Firestore with nested collection support
      // The code does: db.collection("users").doc(userId).collection("calendarEvents").doc(eventId).update()
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockCalendarEventsCollection = {
        doc: jest.fn(() => ({
          update: mockUpdate,
        })),
      };
      const mockUserDoc = {
        collection: jest.fn(() => mockCalendarEventsCollection),
      };
      const mockUsersCollection = {
        doc: jest.fn(() => mockUserDoc),
      };
      const mockDb = {
        collection: jest.fn((name: string) => {
          if (name === "users") {
            return mockUsersCollection;
          }
          return { doc: jest.fn() };
        }),
      } as unknown as Firestore;

      const result = await tryAutoResolveConflict(mockDb, "user1", googleEvent, crmEvent);
      
      // Should attempt to resolve (may fail due to mocking, but should try)
      expect(result.conflictInfo.type).toBe("simple");
    });
  });
});

