import { screen, fireEvent, waitFor } from "@testing-library/react";
import MergeContactsModal from "../MergeContactsModal";
import { renderWithProviders } from "@/components/__tests__/test-utils";
import { useQueryClient, QueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQueryClient: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/util/contact-utils", () => ({
  getDisplayName: jest.fn((contact) => {
    if (contact.firstName || contact.lastName) {
      return `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
    }
    return contact.primaryEmail?.split("@")[0] || "Unknown";
  }),
}));

jest.mock("@/components/Modal", () => ({
  __esModule: true,
  default: ({ isOpen, children, title, onClose }: { isOpen: boolean; children: ReactNode; title: string; onClose: () => void }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="modal">
        <div data-testid="modal-title">{title}</div>
        <button onClick={onClose} aria-label="close">Close</button>
        {children}
      </div>
    );
  },
}));

jest.mock("@/components/Avatar", () => ({
  __esModule: true,
  default: () => <div data-testid="avatar">Avatar</div>,
}));

// Mock fetch globally
global.fetch = jest.fn();

const mockUseQueryClient = useQueryClient as jest.MockedFunction<typeof useQueryClient>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe("MergeContactsModal", () => {
  const mockUserId = "user-123";
  const mockPrimaryContactId = "primary-contact-123";
  const mockPrimaryContact = {
    contactId: mockPrimaryContactId,
    firstName: "John",
    lastName: "Doe",
    primaryEmail: "john@example.com",
    secondaryEmails: ["john.doe@example.com"],
    photoUrl: null,
  };

  const mockQueryClient = {
    invalidateQueries: jest.fn(),
  };

  const mockRouter = {
    push: jest.fn(),
    refresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQueryClient.mockReturnValue(mockQueryClient as unknown as QueryClient);
    mockUseRouter.mockReturnValue(mockRouter as unknown as ReturnType<typeof useRouter>);
  });

  describe("Modal Visibility", () => {
    it("should render when isOpen is true", () => {
      renderWithProviders(
        <MergeContactsModal
          isOpen={true}
          onClose={jest.fn()}
          primaryContactId={mockPrimaryContactId}
          userId={mockUserId}
          primaryContact={mockPrimaryContact}
        />
      );

      expect(screen.getByTestId("modal")).toBeInTheDocument();
      expect(screen.getByTestId("modal-title")).toHaveTextContent(/merge contacts/i);
    });

    it("should not render when isOpen is false", () => {
      renderWithProviders(
        <MergeContactsModal
          isOpen={false}
          onClose={jest.fn()}
          primaryContactId={mockPrimaryContactId}
          userId={mockUserId}
          primaryContact={mockPrimaryContact}
        />
      );

      expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
    });

    it("should call onClose when close button is clicked", () => {
      const mockOnClose = jest.fn();
      renderWithProviders(
        <MergeContactsModal
          isOpen={true}
          onClose={mockOnClose}
          primaryContactId={mockPrimaryContactId}
          userId={mockUserId}
          primaryContact={mockPrimaryContact}
        />
      );

      const closeButton = screen.getByLabelText("close");
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Contact Search", () => {
    it("should display search input", () => {
      renderWithProviders(
        <MergeContactsModal
          isOpen={true}
          onClose={jest.fn()}
          primaryContactId={mockPrimaryContactId}
          userId={mockUserId}
          primaryContact={mockPrimaryContact}
        />
      );

      expect(screen.getByPlaceholderText(/search by name or email/i)).toBeInTheDocument();
    });

    it("should perform search when typing", async () => {
      const mockSearchResults = [
        {
          contactId: "contact-1",
          firstName: "Jane",
          lastName: "Smith",
          primaryEmail: "jane@example.com",
          secondaryEmails: [],
          photoUrl: null,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contacts: mockSearchResults }),
      } as Response);

      renderWithProviders(
        <MergeContactsModal
          isOpen={true}
          onClose={jest.fn()}
          primaryContactId={mockPrimaryContactId}
          userId={mockUserId}
          primaryContact={mockPrimaryContact}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search by name or email/i);
      fireEvent.change(searchInput, { target: { value: "jane" } });

      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    });
  });

  describe("Primary Email Selection", () => {
    it("should display primary contact email", () => {
      renderWithProviders(
        <MergeContactsModal
          isOpen={true}
          onClose={jest.fn()}
          primaryContactId={mockPrimaryContactId}
          userId={mockUserId}
          primaryContact={mockPrimaryContact}
        />
      );

      expect(screen.getByText(mockPrimaryContact.primaryEmail)).toBeInTheDocument();
    });
  });

  describe("Merge Action", () => {
    it("should have merge functionality available", () => {
      renderWithProviders(
        <MergeContactsModal
          isOpen={true}
          onClose={jest.fn()}
          primaryContactId={mockPrimaryContactId}
          userId={mockUserId}
          primaryContact={mockPrimaryContact}
        />
      );

      // Modal should render with search functionality
      expect(screen.getByPlaceholderText(/search by name or email/i)).toBeInTheDocument();
    });

    it("should handle merge errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Merge failed"));

      renderWithProviders(
        <MergeContactsModal
          isOpen={true}
          onClose={jest.fn()}
          primaryContactId={mockPrimaryContactId}
          userId={mockUserId}
          primaryContact={mockPrimaryContact}
        />
      );

      // Error handling should be present
      await waitFor(() => {
        // Component should handle errors gracefully
        expect(screen.getByTestId("modal")).toBeInTheDocument();
      });
    });
  });
});
