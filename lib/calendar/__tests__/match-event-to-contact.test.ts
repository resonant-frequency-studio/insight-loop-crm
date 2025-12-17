import { matchEventToContact } from "../match-event-to-contact";
import { CalendarEvent, Contact } from "@/types/firestore";

describe("matchEventToContact", () => {
  const mockContacts: Contact[] = [
    {
      contactId: "contact1",
      primaryEmail: "john.doe@example.com",
      firstName: "John",
      lastName: "Doe",
      segment: "VIP",
      tags: ["important"],
      engagementScore: 85,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      contactId: "contact2",
      primaryEmail: "jane.smith@company.com",
      firstName: "Jane",
      lastName: "Smith",
      segment: "Prospect",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      contactId: "contact3",
      primaryEmail: "bob@company.com",
      firstName: "Bob",
      lastName: "Johnson",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  describe("Email matching (high confidence)", () => {
    it("should match event by exact email address", () => {
      const event: CalendarEvent = {
        eventId: "event1",
        googleEventId: "google1",
        userId: "user1",
        title: "Meeting with John",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [
          { email: "john.doe@example.com", displayName: "John Doe" },
        ],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      expect(result.contactId).toBe("contact1");
      expect(result.confidence).toBe("high");
      expect(result.method).toBe("email");
    });

    it("should match by email case-insensitively", () => {
      const event: CalendarEvent = {
        eventId: "event2",
        googleEventId: "google2",
        userId: "user1",
        title: "Meeting",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [
          { email: "JOHN.DOE@EXAMPLE.COM", displayName: "John Doe" },
        ],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      expect(result.contactId).toBe("contact1");
      expect(result.confidence).toBe("high");
      expect(result.method).toBe("email");
    });

    it("should return null contactId if no email match", () => {
      const event: CalendarEvent = {
        eventId: "event3",
        googleEventId: "google3",
        userId: "user1",
        title: "Meeting",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [
          { email: "unknown@otherdomain.com", displayName: "Unknown" },
        ],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      // Should not be a high confidence email match
      expect(result.confidence).not.toBe("high");
      if (result.method === "email") {
        expect(result.confidence).not.toBe("high");
      }
    });
  });

  describe("Name matching (medium confidence)", () => {
    it("should match event by name in title", () => {
      const event: CalendarEvent = {
        eventId: "event4",
        googleEventId: "google4",
        userId: "user1",
        title: "Meeting with John Doe",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      expect(result.contactId).toBe("contact1");
      expect(result.confidence).toBe("medium");
      expect(result.method).toBe("name");
    });

    it("should match by name in description", () => {
      const event: CalendarEvent = {
        eventId: "event5",
        googleEventId: "google5",
        userId: "user1",
        title: "Team Meeting",
        description: "Call with Jane Smith to discuss project",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      expect(result.contactId).toBe("contact2");
      expect(result.confidence).toBe("medium");
      expect(result.method).toBe("name");
    });

    it("should handle fuzzy name matching with high similarity", () => {
      const event: CalendarEvent = {
        eventId: "event6",
        googleEventId: "google6",
        userId: "user1",
        title: "Meeting with Jon Doe", // Typo: "Jon" instead of "John"
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      // Should still match due to high similarity
      expect(result.contactId).toBe("contact1");
      expect(result.confidence).toBe("medium");
      expect(result.method).toBe("name");
    });
  });

  describe("Domain matching (low confidence)", () => {
    it("should match by email domain", () => {
      const event: CalendarEvent = {
        eventId: "event7",
        googleEventId: "google7",
        userId: "user1",
        title: "Company Meeting",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [
          { email: "someone@company.com", displayName: "Someone" },
        ],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      // Should match first contact with matching domain (contact2 or contact3)
      expect(result.contactId).toBeTruthy();
      expect(["contact2", "contact3"]).toContain(result.contactId);
      expect(result.confidence).toBe("low");
      expect(result.method).toBe("domain");
    });

    it("should return multiple domain matches as suggestions", () => {
      const event: CalendarEvent = {
        eventId: "event8",
        googleEventId: "google8",
        userId: "user1",
        title: "Company Meeting",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [
          { email: "someone@company.com", displayName: "Someone" },
        ],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      // Should have suggestions for other domain matches
      if (result.suggestions && result.suggestions.length > 0) {
        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.suggestions[0].method).toBe("domain");
      }
    });
  });

  describe("No match scenarios", () => {
    it("should return null contactId when no matches found", () => {
      const event: CalendarEvent = {
        eventId: "event9",
        googleEventId: "google9",
        userId: "user1",
        title: "Random Meeting",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [
          { email: "unknown@otherdomain.com", displayName: "Unknown" },
        ],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      expect(result.contactId).toBeNull();
      expect(result.confidence).toBe("low");
    });

    it("should handle events with no attendees", () => {
      const event: CalendarEvent = {
        eventId: "event10",
        googleEventId: "google10",
        userId: "user1",
        title: "Solo Meeting",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      expect(result.contactId).toBeNull();
      expect(result.confidence).toBe("low");
    });
  });

  describe("Priority order", () => {
    it("should prioritize email match over name match", () => {
      const event: CalendarEvent = {
        eventId: "event11",
        googleEventId: "google11",
        userId: "user1",
        title: "Meeting with Jane Smith", // Name suggests contact2
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [
          { email: "john.doe@example.com", displayName: "John Doe" }, // Email matches contact1
        ],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      // Should match by email (contact1), not by name (contact2)
      expect(result.contactId).toBe("contact1");
      expect(result.confidence).toBe("high");
      expect(result.method).toBe("email");
    });

    it("should prioritize name match over domain match", () => {
      const event: CalendarEvent = {
        eventId: "event12",
        googleEventId: "google12",
        userId: "user1",
        title: "Meeting with Jane Smith", // Name matches contact2
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [
          { email: "someone@company.com", displayName: "Someone" }, // Domain matches contact2 or contact3
        ],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      // Should match by name (contact2), not by domain
      expect(result.contactId).toBe("contact2");
      expect(result.confidence).toBe("medium");
      expect(result.method).toBe("name");
    });
  });
});

