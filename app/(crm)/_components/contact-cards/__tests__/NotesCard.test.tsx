import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import NotesCard from "../NotesCard";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact } from "@/hooks/useContactMutations";
import { useSavingState } from "@/contexts/SavingStateContext";
import { createMockContact, createMockUseQueryResult, createMockUseMutationResult } from "@/components/__tests__/test-utils";
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

      const { container } = render(<NotesCard contactId={mockContactId} userId={mockUserId} />);
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

      render(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
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

      render(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
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

      render(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      const textarea = screen.getByPlaceholderText("Add notes about this contact...") as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "Updated notes" } });
      
      expect(textarea.value).toBe("Updated notes");
    });

    it("calls save when Save button is clicked", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        notes: "Initial notes",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText("Add notes about this contact...");
        expect(textarea).toBeInTheDocument();
      });
      
      const textarea = screen.getByPlaceholderText("Add notes about this contact...");
      fireEvent.change(textarea, { target: { value: "Updated notes" } });
      
      // Click Save button
      const saveButton = await waitFor(() => {
        const button = screen.getByRole("button", { name: /save/i });
        expect(button).not.toBeDisabled();
        return button;
      });
      
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled();
      });
    });

    it("disables Save button when there are no changes", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        notes: "Initial notes",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).toBeDisabled();
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

      render(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText("Add notes about this contact...");
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText("Add notes about this contact...");
      fireEvent.change(textarea, { target: { value: "Updated notes" } });

      // Click Save button
      const saveButton = await waitFor(() => {
        const button = screen.getByRole("button", { name: /save/i });
        expect(button).not.toBeDisabled();
        return button;
      });
      
      fireEvent.click(saveButton);

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

      render(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText("Add notes about this contact...");
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText("Add notes about this contact...");
      fireEvent.change(textarea, { target: { value: "" } });

      // Click Save button
      const saveButton = await waitFor(() => {
        const button = screen.getByRole("button", { name: /save/i });
        expect(button).not.toBeDisabled();
        return button;
      });
      
      fireEvent.click(saveButton);

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

  describe("Save Status", () => {
    it("shows saving indicator during save", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        notes: "Initial notes",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      mockUseUpdateContact.mockReturnValue(
        createMockUseMutationResult<Contact, Error, { contactId: string; updates: Partial<Contact> }, { prevDetail?: Contact | undefined; prevLists: Record<string, Contact[]> }>(
          mockMutate,
          jest.fn(),
          true,
          false,
          false,
          null,
          undefined
        ) as ReturnType<typeof useUpdateContact>
      );

      render(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      const indicator = screen.getByTestId("saving-indicator");
      expect(indicator.getAttribute("data-status")).toBe("idle");
    });

    it("shows saved indicator after successful save", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        notes: "Initial notes",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      mockMutate.mockImplementation((data, options) => {
        // Call onSuccess immediately to simulate successful mutation
        if (options?.onSuccess) {
          setTimeout(() => options.onSuccess(), 0);
        }
      });

      render(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      const textarea = screen.getByPlaceholderText("Add notes about this contact...");
      fireEvent.change(textarea, { target: { value: "Updated notes" } });

      // Click Save button
      const saveButton = await waitFor(() => {
        const button = screen.getByRole("button", { name: /save/i });
        expect(button).not.toBeDisabled();
        return button;
      });
      
      fireEvent.click(saveButton);

      // Should show "Saving..." text during save
      await waitFor(() => {
        expect(screen.getByText("Saving...")).toBeInTheDocument();
      });
    });

    it("shows error indicator on save failure", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        notes: "Initial notes",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      mockMutate.mockImplementation((data, options) => {
        // Call onError immediately to simulate failed mutation
        if (options?.onError) {
          setTimeout(() => options.onError(new Error("Save failed")), 0);
        }
      });

      render(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      const textarea = screen.getByPlaceholderText("Add notes about this contact...");
      fireEvent.change(textarea, { target: { value: "Updated notes" } });

      // Click Save button
      const saveButton = await waitFor(() => {
        const button = screen.getByRole("button", { name: /save/i });
        expect(button).not.toBeDisabled();
        return button;
      });
      
      fireEvent.click(saveButton);

      // Should show "Saving..." text during save
      await waitFor(() => {
        expect(screen.getByText("Saving...")).toBeInTheDocument();
      });
    });
  });

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

      const { rerender } = render(<NotesCard contactId="contact-1" userId={mockUserId} />);
      
      const textarea = screen.getByPlaceholderText("Add notes about this contact...") as HTMLTextAreaElement;
      expect(textarea.value).toBe("Notes 1");

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact2, false, null)
      );

      rerender(<NotesCard contactId="contact-2" userId={mockUserId} />);
      
      expect(textarea.value).toBe("Notes 2");
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

      const { unmount } = render(<NotesCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(mockRegisterSaveStatus).toHaveBeenCalledWith(`notes-${mockContactId}`, "idle");
      
      unmount();
      
      expect(mockUnregisterSaveStatus).toHaveBeenCalledWith(`notes-${mockContactId}`);
    });
  });
});

