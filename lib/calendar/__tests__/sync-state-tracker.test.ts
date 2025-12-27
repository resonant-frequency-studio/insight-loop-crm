import { isEventLocked, wasRecentlySyncedFromOppositeDirection, canSyncEvent } from "../sync-state-tracker";
import { CalendarEvent } from "@/types/firestore";
import { Timestamp } from "firebase-admin/firestore";

describe("sync-state-tracker", () => {
  const baseEvent: CalendarEvent = {
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

  describe("isEventLocked", () => {
    it("should return false when event is not locked", () => {
      const event: CalendarEvent = {
        ...baseEvent,
        syncLockUntil: undefined,
      };

      expect(isEventLocked(event)).toBe(false);
    });

    it("should return true when event is locked", () => {
      const lockUntil = new Date();
      lockUntil.setSeconds(lockUntil.getSeconds() + 60);

      const event: CalendarEvent = {
        ...baseEvent,
        syncLockUntil: Timestamp.fromDate(lockUntil),
      };

      expect(isEventLocked(event)).toBe(true);
    });

    it("should return false when lock has expired", () => {
      const lockUntil = new Date();
      lockUntil.setSeconds(lockUntil.getSeconds() - 60); // 60 seconds ago

      const event: CalendarEvent = {
        ...baseEvent,
        syncLockUntil: Timestamp.fromDate(lockUntil),
      };

      expect(isEventLocked(event)).toBe(false);
    });
  });

  describe("wasRecentlySyncedFromOppositeDirection", () => {
    it("should return false when last sync was from same direction", () => {
      const event: CalendarEvent = {
        ...baseEvent,
        lastSyncedFrom: "google",
        lastSyncedAt: Timestamp.fromDate(new Date()), // Just now
      };

      expect(wasRecentlySyncedFromOppositeDirection(event, "google")).toBe(false);
    });

    it("should return true when last sync was recent from opposite direction", () => {
      const recentSync = new Date();
      recentSync.setSeconds(recentSync.getSeconds() - 10); // 10 seconds ago

      const event: CalendarEvent = {
        ...baseEvent,
        lastSyncedFrom: "google",
        lastSyncedAt: Timestamp.fromDate(recentSync),
      };

      expect(wasRecentlySyncedFromOppositeDirection(event, "crm")).toBe(true);
    });

    it("should return false when last sync was old from opposite direction", () => {
      const oldSync = new Date();
      oldSync.setSeconds(oldSync.getSeconds() - 60); // 60 seconds ago

      const event: CalendarEvent = {
        ...baseEvent,
        lastSyncedFrom: "google",
        lastSyncedAt: Timestamp.fromDate(oldSync),
      };

      expect(wasRecentlySyncedFromOppositeDirection(event, "crm")).toBe(false);
    });

    it("should return false when lastSyncedFrom is missing", () => {
      const event: CalendarEvent = {
        ...baseEvent,
        lastSyncedFrom: undefined,
        lastSyncedAt: Timestamp.fromDate(new Date()),
      };

      expect(wasRecentlySyncedFromOppositeDirection(event, "crm")).toBe(false);
    });
  });

  describe("canSyncEvent", () => {
    it("should return true when event can be synced", () => {
      const event: CalendarEvent = {
        ...baseEvent,
        syncInProgress: false,
        syncLockUntil: undefined,
      };

      const result = canSyncEvent(event, "crm");
      expect(result.canSync).toBe(true);
    });

    it("should return false when event is locked", () => {
      const lockUntil = new Date();
      lockUntil.setSeconds(lockUntil.getSeconds() + 60);

      const event: CalendarEvent = {
        ...baseEvent,
        syncLockUntil: Timestamp.fromDate(lockUntil),
      };

      const result = canSyncEvent(event, "crm");
      expect(result.canSync).toBe(false);
      expect(result.reason).toBe("Event is locked");
    });

    it("should return false when event is already being synced", () => {
      const event: CalendarEvent = {
        ...baseEvent,
        syncInProgress: true,
      };

      const result = canSyncEvent(event, "crm");
      expect(result.canSync).toBe(false);
      expect(result.reason).toBe("Event is already being synced");
    });

    it("should return false when event was recently synced from opposite direction", () => {
      const recentSync = new Date();
      recentSync.setSeconds(recentSync.getSeconds() - 10);

      const event: CalendarEvent = {
        ...baseEvent,
        lastSyncedFrom: "google",
        lastSyncedAt: Timestamp.fromDate(recentSync),
      };

      const result = canSyncEvent(event, "crm");
      expect(result.canSync).toBe(false);
      expect(result.reason).toBe("Event was recently synced from opposite direction");
    });
  });
});

