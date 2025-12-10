import { render, screen } from "@testing-library/react";
import ActionItemsCard from "../ActionItemsCard";
import { useContact } from "@/hooks/useContact";
import { createMockContact, createMockUseQueryResult } from "@/components/__tests__/test-utils";
import type{ Contact } from "@/types/firestore";

jest.mock("@/hooks/useContact");
jest.mock("../../ActionItemsList", () => ({
  __esModule: true,
  default: ({ contactId, userId, contactEmail }: { contactId: string; userId: string; contactEmail?: string }) => (
    <div data-testid="action-items-list">
      ActionItemsList for {contactId} (user: {userId}, email: {contactEmail})
    </div>
  ),
}));

const mockUseContact = useContact as jest.MockedFunction<typeof useContact>;

describe("ActionItemsCard", () => {
  const mockUserId = "user-123";
  const mockContactId = "contact-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("shows loading state when contact is not available", () => {
      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(undefined, true, null)
      );

      const { container } = render(
        <ActionItemsCard
          contactId={mockContactId}
          userId={mockUserId}
        />
      );
      
      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Rendering", () => {
    it("renders ActionItemsList with correct props when contact is loaded", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        primaryEmail: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        company: "Test Company",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(
        <ActionItemsCard
          contactId={mockContactId}
          userId={mockUserId}
        />
      );

      expect(screen.getByText("Action Items")).toBeInTheDocument();
      expect(screen.getByTestId("action-items-list")).toBeInTheDocument();
      expect(screen.getByText(/ActionItemsList for contact-123/)).toBeInTheDocument();
    });

    it("uses initialContact when contact is not loaded from hook", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        primaryEmail: "initial@example.com",
        firstName: "Initial",
        lastName: "Contact",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(undefined, false, null)
      );

      render(
        <ActionItemsCard
          contactId={mockContactId}
          userId={mockUserId}
          initialContact={mockContact}
        />
      );

      expect(screen.getByText("Action Items")).toBeInTheDocument();
      expect(screen.getByTestId("action-items-list")).toBeInTheDocument();
    });

    it("passes contact data to ActionItemsList", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        primaryEmail: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        company: "Test Company",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(
        <ActionItemsCard
          contactId={mockContactId}
          userId={mockUserId}
          initialActionItems={[]}
        />
      );

      const actionItemsList = screen.getByTestId("action-items-list");
      expect(actionItemsList).toHaveTextContent("email: test@example.com");
    });

    it("renders descriptive text", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(
        <ActionItemsCard
          contactId={mockContactId}
          userId={mockUserId}
        />
      );

      expect(screen.getByText(/Track tasks and follow-ups for this contact/)).toBeInTheDocument();
    });
  });
});

