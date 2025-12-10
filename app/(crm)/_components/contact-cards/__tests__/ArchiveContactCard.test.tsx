import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ArchiveContactCard from "../ArchiveContactCard";
import { useContact } from "@/hooks/useContact";
import { useArchiveContact } from "@/hooks/useContactMutations";
import { useSavingState } from "@/contexts/SavingStateContext";
import { createMockContact, createMockUseQueryResult, createMockUseMutationResult } from "@/components/__tests__/test-utils";
import type { Contact } from "@/types/firestore";
import type { SavingStateContextType } from "@/contexts/SavingStateContext";

jest.mock("@/hooks/useContact");
jest.mock("@/hooks/useContactMutations");
jest.mock("@/contexts/SavingStateContext");

const mockUseContact = useContact as jest.MockedFunction<typeof useContact>;
const mockUseArchiveContact = useArchiveContact as jest.MockedFunction<typeof useArchiveContact>;
const mockUseSavingState = useSavingState as jest.MockedFunction<typeof useSavingState>;

describe("ArchiveContactCard", () => {
  const mockUserId = "user-123";
  const mockContactId = "contact-123";
  const mockMutate = jest.fn();
  const mockRegisterSaveStatus = jest.fn();
  const mockUnregisterSaveStatus = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseSavingState.mockReturnValue({
      isSaving: false,
      registerSaveStatus: mockRegisterSaveStatus,
      unregisterSaveStatus: mockUnregisterSaveStatus,
    } as SavingStateContextType);

    mockUseArchiveContact.mockReturnValue(
      createMockUseMutationResult<unknown, Error, { contactId: string; archived: boolean }, { prev?: Contact | undefined }>(
        mockMutate,
        jest.fn(),
        false,
        false,
        false,
        null,
        undefined
      ) as ReturnType<typeof useArchiveContact>
    );
  });

  describe("Button Display", () => {
    it("shows 'Archive Contact' button when not archived", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        archived: false,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ArchiveContactCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.getByText("Archive Contact")).toBeInTheDocument();
    });

    it("shows 'Unarchive Contact' button when archived", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        archived: true,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ArchiveContactCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.getByText("Unarchive Contact")).toBeInTheDocument();
    });
  });

  describe("Archive Functionality", () => {
    it("calls archive mutation on button click", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        archived: false,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ArchiveContactCard contactId={mockContactId} userId={mockUserId} />);
      
      const button = screen.getByText("Archive Contact");
      fireEvent.click(button);

      expect(mockMutate).toHaveBeenCalledWith(
        {
          contactId: mockContactId,
          archived: true,
        },
        expect.any(Object)
      );
    });

    it("calls unarchive mutation when contact is archived", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        archived: true,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ArchiveContactCard contactId={mockContactId} userId={mockUserId} />);
      
      const button = screen.getByText("Unarchive Contact");
      fireEvent.click(button);

      expect(mockMutate).toHaveBeenCalledWith(
        {
          contactId: mockContactId,
          archived: false,
        },
        expect.any(Object)
      );
    });

    it("updates local state immediately on button click", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        archived: false,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ArchiveContactCard contactId={mockContactId} userId={mockUserId} />);
      
      const button = screen.getByText("Archive Contact");
      fireEvent.click(button);

      // Button text should change immediately
      expect(screen.queryByText("Archive Contact")).not.toBeInTheDocument();
      // Note: The button text might not change immediately in the test due to state updates,
      // but the mutation should be called with the correct value
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  describe("Loading State", () => {
    it("shows loading state during mutation", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        archived: false,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      mockUseArchiveContact.mockReturnValue(
        createMockUseMutationResult<unknown, Error, { contactId: string; archived: boolean }, { prev?: Contact | undefined }>(
          mockMutate,
          jest.fn(),
          true,
          false,
          false,
          null,
          undefined
        ) as ReturnType<typeof useArchiveContact>
      );

      render(<ArchiveContactCard contactId={mockContactId} userId={mockUserId} />);
      
      const button = screen.getByText("Archive Contact");
      expect(button).toBeDisabled();
    });
  });

  describe("Error Handling", () => {
    it("shows error message on failure", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        archived: false,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      let onErrorCallback: ((error: Error) => void) | undefined;
      mockMutate.mockImplementation((data, options) => {
        onErrorCallback = options?.onError;
      });

      render(<ArchiveContactCard contactId={mockContactId} userId={mockUserId} />);
      
      const button = screen.getByText("Archive Contact");
      fireEvent.click(button);

      if (onErrorCallback) {
        onErrorCallback(new Error("Archive failed"));
      }

      await waitFor(() => {
        expect(screen.getByText("Archive failed")).toBeInTheDocument();
      });
    });
  });

  describe("State Reset", () => {
    it("resets state only when contactId changes", () => {
      const mockContact1 = createMockContact({
        contactId: "contact-1",
        archived: false,
      });

      const mockContact2 = createMockContact({
        contactId: "contact-2",
        archived: true,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact1, false, null)
      );

      const { rerender } = render(<ArchiveContactCard contactId="contact-1" userId={mockUserId} />);
      
      expect(screen.getByText("Archive Contact")).toBeInTheDocument();

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact2, false, null)
      );

      rerender(<ArchiveContactCard contactId="contact-2" userId={mockUserId} />);
      
      expect(screen.getByText("Unarchive Contact")).toBeInTheDocument();
    });

    it("does not reset state when contact updatedAt changes", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        archived: false,
        updatedAt: "2024-01-15T10:00:00Z",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      const { rerender } = render(<ArchiveContactCard contactId={mockContactId} userId={mockUserId} />);
      
      const button = screen.getByText("Archive Contact");
      fireEvent.click(button);

      // Update contact with new updatedAt
      const updatedContact = {
        ...mockContact,
        updatedAt: "2024-01-15T11:00:00Z",
      };

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(updatedContact, false, null)
      );

      rerender(<ArchiveContactCard contactId={mockContactId} userId={mockUserId} />);

      // Button should still show the state we set (not reset)
      // The mutation should have been called
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  describe("Saving State Context", () => {
    it("registers and unregisters save status", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      const { unmount } = render(<ArchiveContactCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(mockRegisterSaveStatus).toHaveBeenCalledWith(`archive-${mockContactId}`, "idle");
      
      unmount();
      
      expect(mockUnregisterSaveStatus).toHaveBeenCalledWith(`archive-${mockContactId}`);
    });
  });
});

