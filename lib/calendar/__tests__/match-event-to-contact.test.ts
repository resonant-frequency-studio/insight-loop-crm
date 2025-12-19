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
    {
      contactId: "contact4",
      primaryEmail: "sahana.murthy@example.com",
      firstName: "Sahana",
      lastName: "Murthy",
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

    it("should exclude user's own email from matching", () => {
      const event: CalendarEvent = {
        eventId: "event3",
        googleEventId: "google3",
        userId: "user1",
        title: "Meeting",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [
          { email: "john.doe@example.com", displayName: "John Doe" },
        ],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // User's email is john.doe@example.com, so it should not match
      const result = matchEventToContact(event, mockContacts, "john.doe@example.com");

      expect(result.contactId).toBeNull();
      expect(result.confidence).toBe("low");
    });

    it("should return null contactId if no email match", () => {
      const event: CalendarEvent = {
        eventId: "event4",
        googleEventId: "google4",
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

      expect(result.contactId).toBeNull();
      expect(result.confidence).toBe("low");
    });
  });

  describe("Last name matching (medium confidence - suggestions only)", () => {
    it("should suggest contacts with exact last name match", () => {
      const event: CalendarEvent = {
        eventId: "event5",
        googleEventId: "google5",
        userId: "user1",
        title: "Sahana Murthy and Charlene Wilson",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      // Should not auto-link, but should have suggestions
      expect(result.contactId).toBeNull();
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
      
      // Should suggest contact4 (Sahana Murthy) with medium confidence
      const murthySuggestion = result.suggestions?.find(s => s.contactId === "contact4");
      expect(murthySuggestion).toBeDefined();
      expect(murthySuggestion?.confidence).toBe("medium");
      expect(murthySuggestion?.method).toBe("lastname");
    });

    it("should not match with fuzzy name similarity", () => {
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

      // Should not match because "Jon" is not exactly "John"
      // But "Doe" should match as last name suggestion
      expect(result.contactId).toBeNull();
      if (result.suggestions) {
        const doeSuggestion = result.suggestions.find(s => s.contactId === "contact1");
        expect(doeSuggestion?.confidence).toBe("medium");
        expect(doeSuggestion?.method).toBe("lastname");
      }
    });
  });

  describe("First name matching (low confidence - suggestions only)", () => {
    it("should suggest contacts with exact first name match", () => {
      const event: CalendarEvent = {
        eventId: "event7",
        googleEventId: "google7",
        userId: "user1",
        title: "Sahana Murthy and Charlene Wilson",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      // Should not auto-link, but should have suggestions
      expect(result.contactId).toBeNull();
      expect(result.suggestions).toBeDefined();
      
      // Should suggest contact4 (Sahana Murthy) with low confidence for first name
      const sahanaSuggestion = result.suggestions?.find(
        s => s.contactId === "contact4" && s.method === "firstname"
      );
      expect(sahanaSuggestion).toBeDefined();
      expect(sahanaSuggestion?.confidence).toBe("low");
      expect(sahanaSuggestion?.method).toBe("firstname");
    });
  });

  describe("No match scenarios", () => {
    it("should return null contactId when no matches found", () => {
      const event: CalendarEvent = {
        eventId: "event8",
        googleEventId: "google8",
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
      expect(result.suggestions).toBeUndefined();
    });

    it("should handle events with no attendees", () => {
      const event: CalendarEvent = {
        eventId: "event9",
        googleEventId: "google9",
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

    it("should handle events with title that doesn't contain names", () => {
      const event: CalendarEvent = {
        eventId: "event10",
        googleEventId: "google10",
        userId: "user1",
        title: "Team Standup",
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
      expect(result.suggestions).toBeUndefined();
    });
  });

  describe("Priority order", () => {
    it("should prioritize email match over name suggestions", () => {
      const event: CalendarEvent = {
        eventId: "event11",
        googleEventId: "google11",
        userId: "user1",
        title: "Sahana Murthy Meeting", // Name suggests contact4
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [
          { email: "sahana.murthy@example.com", displayName: "Sahana Murthy" }, // Email matches contact4
        ],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      // Should match by email (contact4), not just suggest by name
      expect(result.contactId).toBe("contact4");
      expect(result.confidence).toBe("high");
      expect(result.method).toBe("email");
    });

    it("should provide both last name and first name suggestions when available", () => {
      const event: CalendarEvent = {
        eventId: "event12",
        googleEventId: "google12",
        userId: "user1",
        title: "Sahana Murthy",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        attendees: [],
        lastSyncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = matchEventToContact(event, mockContacts);

      // Should not auto-link
      expect(result.contactId).toBeNull();
      
      // Should have suggestions for both last name (medium) and first name (low)
      expect(result.suggestions).toBeDefined();
      const murthySuggestions = result.suggestions?.filter(s => s.contactId === "contact4");
      expect(murthySuggestions?.length).toBe(2);
      
      const lastNameSuggestion = murthySuggestions?.find(s => s.method === "lastname");
      const firstNameSuggestion = murthySuggestions?.find(s => s.method === "firstname");
      
      expect(lastNameSuggestion?.confidence).toBe("medium");
      expect(firstNameSuggestion?.confidence).toBe("low");
    });
  });
});
