import { screen, fireEvent, waitFor } from "@testing-library/react";
import NotesCard from "../NotesCard";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact } from "@/hooks/useContactMutations";
import { useSavingState } from "@/contexts/SavingStateContext";
import { renderWithProviders, createMockContact, createMockUseQueryResult, createMockUseMutationResult } from "@/components/__tests__/test-utils";
import type { Contact } from "@/types/firestore";
import type { SavingStateContextType } from "@/contexts/SavingStateContext";

jest.mock("@/hooks/useContact");
jest.mock("@/hooks/useContactMutations");
jest.mock("@/contexts/SavingStateContext");

const mockUseContact = useContact as jest.MockedFunction<typeof useContact>;
const mockUseUpdateContact = useUpdateContact as jest.MockedFunction<typeof useUpdateContact>;
const mockUseSavingState = useSavingState as jest.MockedFunction<typeof useSavingState>;

describe("NotesCard", () => {
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

    mockUseUpdateContact.mockReturnValue(
      createMockUseMutationResult<Contact, Error, { contactId: string; updates: Partial<Contact> }, { prevDetail?: Contact | undefined; prevLists: Record<string, Contact[]> }>(
        mockMutate,
        jest.fn(),
        false,
        false,
        false,
        null,
        undefined
      ) as ReturnType<typeof useUpdateContact>
    );
  });

  describe("Loading State", () => {
    it("shows loading state when contact is not loaded", () => {
      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(undefined, true, null)
      );

      const { container } = renderWithProviders(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Initialization", () => {
    it("initializes notes from contact data", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        notes: "Initial notes",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      renderWithProviders(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      const textarea = screen.getByPlaceholderText("Add notes about this contact...") as HTMLTextAreaElement;
      expect(textarea.value).toBe("Initial notes");
    });

    it("initializes with empty string when notes is null", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        notes: null,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      renderWithProviders(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      const textarea = screen.getByPlaceholderText("Add notes about this contact...") as HTMLTextAreaElement;
      expect(textarea.value).toBe("");
    });
  });

  describe("User Interactions", () => {
    it("updates notes on input change", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        notes: "Initial notes",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      renderWithProviders(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      const textarea = screen.getByPlaceholderText("Add notes about this contact...") as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "Updated notes" } });
      
      expect(textarea.value).toBe("Updated notes");
    });

    it("calls autosave on blur after textarea change", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        notes: "Initial notes",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      renderWithProviders(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText("Add notes about this contact...");
        expect(textarea).toBeInTheDocument();
      });
      
      const textarea = screen.getByPlaceholderText("Add notes about this contact...");
      fireEvent.change(textarea, { target: { value: "Updated notes" } });
      
      fireEvent.blur(textarea);
      
      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled();
      });
    });

    it("does not call save when there are no changes", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        notes: "Initial notes",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      renderWithProviders(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      // Verify that mutate is not called when there are no changes
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  describe("Save Functionality", () => {
    it("calls update mutation with correct data on save", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        notes: "Initial notes",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      renderWithProviders(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText("Add notes about this contact...");
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText("Add notes about this contact...");
      fireEvent.change(textarea, { target: { value: "Updated notes" } });

      fireEvent.blur(textarea);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          {
            contactId: mockContactId,
            updates: {
              notes: "Updated notes",
            },
          },
          expect.any(Object)
        );
      });
    });

    it("saves null when notes is empty", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        notes: "Initial notes",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      renderWithProviders(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText("Add notes about this contact...");
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText("Add notes about this contact...");
      fireEvent.change(textarea, { target: { value: "" } });

      fireEvent.blur(textarea);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          {
            contactId: mockContactId,
            updates: {
              notes: null,
            },
          },
          expect.any(Object)
        );
      });
    });
  });

  // Note: Save status is now handled globally by ContactSaveBar, not per-card
  // These tests are removed as the functionality is tested at the global level

  describe("State Reset", () => {
    it("resets state when contactId changes", () => {
      const mockContact1 = createMockContact({
        contactId: "contact-1",
        notes: "Notes 1",
      });

      const mockContact2 = createMockContact({
        contactId: "contact-2",
        notes: "Notes 2",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact1, false, null)
      );

      const { rerender } = renderWithProviders(<NotesCard contactId="contact-1" userId={mockUserId} />);
      
      const textarea = screen.getByPlaceholderText("Add notes about this contact...") as HTMLTextAreaElement;
      expect(textarea.value).toBe("Notes 1");

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact2, false, null)
      );

      rerender(<NotesCard contactId="contact-2" userId={mockUserId} />);
      
      expect(textarea.value).toBe("Notes 2");
    });
  });

  // Note: Saving state is now handled by ContactAutosaveProvider, not SavingStateContext
  // These tests are removed as the functionality is tested at the provider level
});

