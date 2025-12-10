import { render, screen } from "@testing-library/react";
import ActivityCard from "../ActivityCard";
import { useContact } from "@/hooks/useContact";
import { formatContactDate } from "@/util/contact-utils";
import { createMockContact, createMockUseQueryResult } from "@/components/__tests__/test-utils";
import type { Contact } from "@/types/firestore";

jest.mock("@/hooks/useContact");
jest.mock("@/util/contact-utils", () => ({
  formatContactDate: jest.fn((date, options) => {
    if (options?.includeTime) {
      return "2024-01-15 10:30 AM";
    }
    return "2024-01-15";
  }),
}));

const mockUseContact = useContact as jest.MockedFunction<typeof useContact>;
const mockFormatContactDate = formatContactDate as jest.MockedFunction<typeof formatContactDate>;

describe("ActivityCard", () => {
  const mockUserId = "user-123";
  const mockContactId = "contact-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("shows loading state when contact is not loaded", () => {
      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(undefined, true, null)
      );

      const { container } = render(<ActivityCard contactId={mockContactId} userId={mockUserId} />);
      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Contact Data Display", () => {
    it("displays last updated date", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        updatedAt: "2024-01-15T10:30:00Z",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ActivityCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.getByText("Last updated")).toBeInTheDocument();
      expect(mockFormatContactDate).toHaveBeenCalledWith(
        mockContact.updatedAt,
        { includeTime: true }
      );
      // Check that the formatted date appears in the document (may appear multiple times)
      expect(screen.getAllByText("2024-01-15 10:30 AM").length).toBeGreaterThan(0);
    });

    it("displays created date when available", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        createdAt: "2024-01-10T08:00:00Z",
        updatedAt: "2024-01-15T10:30:00Z",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ActivityCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.getByText("Created")).toBeInTheDocument();
      expect(mockFormatContactDate).toHaveBeenCalledWith(
        mockContact.createdAt,
        { includeTime: true }
      );
    });

    it("does not display created date when not available", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        createdAt: undefined,
        updatedAt: "2024-01-15T10:30:00Z",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ActivityCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.getByText("Last updated")).toBeInTheDocument();
      // The component checks `createdAt != null`, so undefined should not render
      expect(screen.queryByText("Created")).not.toBeInTheDocument();
    });
  });

  describe("Uses formatContactDate utility correctly", () => {
    it("calls formatContactDate with includeTime option for dates", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        updatedAt: "2024-01-15T10:30:00Z",
        createdAt: "2024-01-10T08:00:00Z",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ActivityCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(mockFormatContactDate).toHaveBeenCalledWith(
        mockContact.updatedAt,
        { includeTime: true }
      );
      expect(mockFormatContactDate).toHaveBeenCalledWith(
        mockContact.createdAt,
        { includeTime: true }
      );
    });
  });
});

