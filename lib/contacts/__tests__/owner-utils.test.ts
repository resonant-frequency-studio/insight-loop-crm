import { isOwnerContact, ensureOwnerTag } from "../owner-utils";
import { Contact } from "@/types/firestore";

describe("owner-utils", () => {
  describe("isOwnerContact", () => {
    it("returns true when emails match (case insensitive)", () => {
      expect(isOwnerContact("user@example.com", "user@example.com")).toBe(true);
      expect(isOwnerContact("User@Example.com", "user@example.com")).toBe(true);
      expect(isOwnerContact("user@example.com", "User@Example.com")).toBe(true);
    });

    it("returns true when emails match with whitespace", () => {
      expect(isOwnerContact(" user@example.com ", "user@example.com")).toBe(true);
      expect(isOwnerContact("user@example.com", " user@example.com ")).toBe(true);
    });

    it("returns false when emails do not match", () => {
      expect(isOwnerContact("user@example.com", "other@example.com")).toBe(false);
      expect(isOwnerContact("user@example.com", "user@other.com")).toBe(false);
    });

    it("returns false when userEmail is null", () => {
      expect(isOwnerContact(null, "user@example.com")).toBe(false);
    });

    it("returns false when contactEmail is null", () => {
      expect(isOwnerContact("user@example.com", null as unknown as string)).toBe(false);
    });

    it("returns false when both are null", () => {
      expect(isOwnerContact(null, null as unknown as string)).toBe(false);
    });
  });

  describe("ensureOwnerTag", () => {
    const mockUserEmail = "user@example.com";
    const mockContactEmail = "user@example.com";
    const mockOtherEmail = "other@example.com";

    it("adds Owner tag when email matches and tag is missing", () => {
      const contact: Partial<Contact> = {
        primaryEmail: mockContactEmail,
        tags: [],
      };

      const result = ensureOwnerTag(contact, mockUserEmail);
      expect(result.tags).toContain("Owner");
      expect(result.tags?.length).toBe(1);
    });

    it("does not add duplicate Owner tag when already present", () => {
      const contact: Partial<Contact> = {
        primaryEmail: mockContactEmail,
        tags: ["Owner"],
      };

      const result = ensureOwnerTag(contact, mockUserEmail);
      expect(result.tags).toContain("Owner");
      expect(result.tags?.length).toBe(1);
    });

    it("removes Owner tag when email does not match", () => {
      const contact: Partial<Contact> = {
        primaryEmail: mockOtherEmail,
        tags: ["Owner", "Other Tag"],
      };

      const result = ensureOwnerTag(contact, mockUserEmail);
      expect(result.tags).not.toContain("Owner");
      expect(result.tags).toContain("Other Tag");
      expect(result.tags?.length).toBe(1);
    });

    it("preserves other tags when adding Owner tag", () => {
      const contact: Partial<Contact> = {
        primaryEmail: mockContactEmail,
        tags: ["Tag1", "Tag2"],
      };

      const result = ensureOwnerTag(contact, mockUserEmail);
      expect(result.tags).toContain("Owner");
      expect(result.tags).toContain("Tag1");
      expect(result.tags).toContain("Tag2");
      expect(result.tags?.length).toBe(3);
    });

    it("preserves other tags when removing Owner tag", () => {
      const contact: Partial<Contact> = {
        primaryEmail: mockOtherEmail,
        tags: ["Owner", "Tag1", "Tag2"],
      };

      const result = ensureOwnerTag(contact, mockUserEmail);
      expect(result.tags).not.toContain("Owner");
      expect(result.tags).toContain("Tag1");
      expect(result.tags).toContain("Tag2");
      expect(result.tags?.length).toBe(2);
    });

    it("returns contact unchanged when no primaryEmail", () => {
      const contact: Partial<Contact> = {
        tags: ["Owner"],
      };

      const result = ensureOwnerTag(contact, mockUserEmail);
      expect(result).toEqual(contact);
    });

    it("handles case-insensitive email matching", () => {
      const contact: Partial<Contact> = {
        primaryEmail: "User@Example.com",
        tags: [],
      };

      const result = ensureOwnerTag(contact, "user@example.com");
      expect(result.tags).toContain("Owner");
    });

    it("handles null userEmail", () => {
      const contact: Partial<Contact> = {
        primaryEmail: mockContactEmail,
        tags: ["Owner"],
      };

      const result = ensureOwnerTag(contact, null);
      expect(result.tags).not.toContain("Owner");
    });

    it("creates tags array if it doesn't exist when adding Owner tag", () => {
      const contact: Partial<Contact> = {
        primaryEmail: mockContactEmail,
      };

      const result = ensureOwnerTag(contact, mockUserEmail);
      expect(result.tags).toContain("Owner");
      expect(result.tags?.length).toBe(1);
    });
  });
});

