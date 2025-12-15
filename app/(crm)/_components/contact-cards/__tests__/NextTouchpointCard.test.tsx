import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NextTouchpointCard from "../NextTouchpointCard";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact } from "@/hooks/useContactMutations";
import { useSavingState } from "@/contexts/SavingStateContext";
import { createMockContact, createMockUseQueryResult, createMockUseMutationResult } from "@/components/__tests__/test-utils";
import { Timestamp } from "firebase/firestore";
import type { Contact } from "@/types/firestore";

jest.mock("@/hooks/useContact");
jest.mock("@/hooks/useContactMutations");
jest.mock("@/contexts/SavingStateContext");
jest.mock("../../TouchpointStatusActions", () => ({
  __esModule: true,
  default: ({ contactId, contactName }: { contactId: string; contactName: string }) => (
    <div data-testid="touchpoint-status-actions">
      Actions for {contactName} ({contactId})
    </div>
  ),
}));

const mockUseContact = useContact as jest.MockedFunction<typeof useContact>;
const mockUseUpdateContact = useUpdateContact as jest.MockedFunction<typeof useUpdateContact>;
const mockUseSavingState = useSavingState as jest.MockedFunction<typeof useSavingState>;

describe("NextTouchpointCard", () => {
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
    });

    const mockMutateAsync = jest.fn().mockResolvedValue({});
    mockUseUpdateContact.mockReturnValue(
      createMockUseMutationResult<Contact, Error, { contactId: string; updates: Partial<Contact> }, { prevDetail?: Contact | undefined; prevLists: Record<string, Contact[]> }>(
        mockMutate,
        mockMutateAsync
      ) as ReturnType<typeof useUpdateContact>
    );
  });

  describe("Loading State", () => {
    it("shows loading state when contact is not loaded", () => {
      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(undefined, true));

      const { container } = render(<NextTouchpointCard contactId={mockContactId} userId={mockUserId} />);
      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Initialization", () => {
    it("initializes date and message from contact", async () => {
      const mockDate = new Date("2024-01-15");
      const mockContact = createMockContact({
        contactId: mockContactId,
        nextTouchpointDate: Timestamp.fromDate(mockDate),
        nextTouchpointMessage: "Follow up message",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<NextTouchpointCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for inputs to be rendered and initialized (label is "Date", not "Next Touchpoint Date")
      const dateInput = await waitFor(() => {
        const input = screen.getByLabelText(/^Date$/i) as HTMLInputElement;
        expect(input).toBeInTheDocument();
        expect(input.value).toBe("2024-01-15");
        return input;
      });
      
      const messageTextarea = screen.getByPlaceholderText("What should you discuss in the next touchpoint?") as HTMLTextAreaElement;

      expect(dateInput.value).toBe("2024-01-15");
      expect(messageTextarea.value).toBe("Follow up message");
    });

    it("initializes with empty values when fields are null", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        nextTouchpointDate: null,
        nextTouchpointMessage: null,
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<NextTouchpointCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for inputs to be rendered and initialized (label is "Date", not "Next Touchpoint Date")
      const dateInput = await waitFor(() => {
        const input = screen.getByLabelText(/^Date$/i) as HTMLInputElement;
        expect(input).toBeInTheDocument();
        expect(input.value).toBe("");
        return input;
      });
      
      const messageTextarea = screen.getByPlaceholderText("What should you discuss in the next touchpoint?") as HTMLTextAreaElement;

      expect(dateInput.value).toBe("");
      expect(messageTextarea.value).toBe("");
    });
  });

  describe("User Interactions", () => {
    it("updates date on input change", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        nextTouchpointDate: Timestamp.fromDate(new Date("2024-01-15")),
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<NextTouchpointCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for input to be rendered (label is "Date")
      const dateInput = await waitFor(() => {
        const input = screen.getByLabelText(/^Date$/i) as HTMLInputElement;
        expect(input).toBeInTheDocument();
        return input;
      });
      
      fireEvent.change(dateInput, { target: { value: "2024-01-20" } });
      
      expect(dateInput.value).toBe("2024-01-20");
    });

    it("updates message on textarea change", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        nextTouchpointMessage: "Initial message",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<NextTouchpointCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for textarea to be rendered
      const messageTextarea = await waitFor(() => {
        const textarea = screen.getByPlaceholderText("What should you discuss in the next touchpoint?") as HTMLTextAreaElement;
        expect(textarea).toBeInTheDocument();
        return textarea;
      });
      
      fireEvent.change(messageTextarea, { target: { value: "Updated message" } });
      
      expect(messageTextarea.value).toBe("Updated message");
    });

    it("calls save when Save button is clicked", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        nextTouchpointDate: Timestamp.fromDate(new Date("2024-01-15")),
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<NextTouchpointCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for input to be rendered
      const dateInput = await waitFor(() => {
        const input = screen.getByLabelText(/^Date$/i);
        expect(input).toBeInTheDocument();
        return input;
      });
      
      fireEvent.change(dateInput, { target: { value: "2024-01-20" } });
      
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
  });

  describe("Save Functionality", () => {
    it("calls update mutation with correct data on save", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        nextTouchpointDate: Timestamp.fromDate(new Date("2024-01-15")),
        nextTouchpointMessage: "Initial message",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<NextTouchpointCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for input to be rendered
      const dateInput = await waitFor(() => {
        const input = screen.getByLabelText(/^Date$/i);
        expect(input).toBeInTheDocument();
        return input;
      });
      
      fireEvent.change(dateInput, { target: { value: "2024-01-20" } });

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
            updates: expect.objectContaining({
              nextTouchpointDate: expect.any(String),
            }),
          },
          expect.any(Object)
        );
      });
    });

    it("only saves when there are unsaved changes", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        nextTouchpointDate: Timestamp.fromDate(new Date("2024-01-15")),
        nextTouchpointMessage: "Initial message",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<NextTouchpointCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for input to be rendered
      await waitFor(() => {
        const dateInput = screen.getByLabelText(/^Date$/i);
        expect(dateInput).toBeInTheDocument();
      });
      
      // Don't make any changes - Save button should be disabled
      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).toBeDisabled();
      
      // The save function should not be called if there are no changes
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  describe("TouchpointStatusActions", () => {
    it("renders TouchpointStatusActions with correct props", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        firstName: "John",
        lastName: "Doe",
        nextTouchpointDate: Timestamp.fromDate(new Date("2024-01-15")),
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<NextTouchpointCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for component to render
      const actions = await waitFor(() => {
        const element = screen.getByTestId("touchpoint-status-actions");
        expect(element).toBeInTheDocument();
        return element;
      });
      
      expect(actions).toHaveTextContent("John Doe");
      expect(actions).toHaveTextContent(mockContactId);
    });
  });

  describe("State Reset", () => {
    it("resets state when contactId changes", async () => {
      const mockContact1 = createMockContact({
        contactId: "contact-1",
        nextTouchpointDate: Timestamp.fromDate(new Date("2024-01-15")),
        nextTouchpointMessage: "Message 1",
      });

      const mockContact2 = createMockContact({
        contactId: "contact-2",
        nextTouchpointDate: Timestamp.fromDate(new Date("2024-01-20")),
        nextTouchpointMessage: "Message 2",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact1));

      const { rerender } = render(<NextTouchpointCard contactId="contact-1" userId={mockUserId} />);
      
      // Wait for input to be rendered and initialized (label is "Date")
      const dateInput = await waitFor(() => {
        const input = screen.getByLabelText(/^Date$/i) as HTMLInputElement;
        expect(input).toBeInTheDocument();
        expect(input.value).toBe("2024-01-15");
        return input;
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact2));

      rerender(<NextTouchpointCard contactId="contact-2" userId={mockUserId} />);
      
      await waitFor(() => {
        expect(dateInput.value).toBe("2024-01-20");
      });
    });
  });

  describe("Descriptive Text", () => {
    it("renders descriptive text", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<NextTouchpointCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.getByText(/Schedule and plan your next interaction/)).toBeInTheDocument();
    });
  });
});

