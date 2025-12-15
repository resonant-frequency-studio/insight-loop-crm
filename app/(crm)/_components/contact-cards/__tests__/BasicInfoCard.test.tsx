import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BasicInfoCard from "../BasicInfoCard";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact } from "@/hooks/useContactMutations";
import { useSavingState } from "@/contexts/SavingStateContext";
import { createMockContact, createMockUseQueryResult, createMockUseMutationResult } from "@/components/__tests__/test-utils";
import type { Contact } from "@/types/firestore";

jest.mock("@/hooks/useContact");
jest.mock("@/hooks/useContactMutations");
jest.mock("@/contexts/SavingStateContext");

const mockUseContact = useContact as jest.MockedFunction<typeof useContact>;
const mockUseUpdateContact = useUpdateContact as jest.MockedFunction<typeof useUpdateContact>;
const mockUseSavingState = useSavingState as jest.MockedFunction<typeof useSavingState>;

describe("BasicInfoCard", () => {
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

      const { container } = render(<BasicInfoCard contactId={mockContactId} userId={mockUserId} />);
      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Initialization", () => {
    it("initializes form fields from contact data", async () => {
      // Create a stable mock contact object
      const mockContact = createMockContact({
        contactId: mockContactId,
        firstName: "John",
        lastName: "Doe",
        company: "Test Company",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<BasicInfoCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for all inputs to be rendered and initialized with the correct values
      // The component initializes form state in a useEffect, so we need to wait for all fields
      await waitFor(
        () => {
          const firstNameInput = screen.getByPlaceholderText("First Name") as HTMLInputElement;
          const lastNameInput = screen.getByPlaceholderText("Last Name") as HTMLInputElement;
          const companyInput = screen.getByPlaceholderText("Company") as HTMLInputElement;
          
          expect(firstNameInput.value).toBe("John");
          expect(lastNameInput.value).toBe("Doe");
          expect(companyInput.value).toBe("Test Company");
        },
        { timeout: 3000 }
      );
      
      // Verify again after waiting
      const firstNameInput = screen.getByPlaceholderText("First Name") as HTMLInputElement;
      const lastNameInput = screen.getByPlaceholderText("Last Name") as HTMLInputElement;
      const companyInput = screen.getByPlaceholderText("Company") as HTMLInputElement;

      expect(firstNameInput.value).toBe("John");
      expect(lastNameInput.value).toBe("Doe");
      expect(companyInput.value).toBe("Test Company");
    });

    it("initializes with empty strings when fields are null", async () => {
      // Create mock contact with explicit null values
      const mockContact = {
        ...createMockContact({
          contactId: mockContactId,
        }),
        firstName: null,
        lastName: null,
        company: null,
      };

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<BasicInfoCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for all inputs to be rendered and initialized with empty values
      await waitFor(
        () => {
          const firstNameInput = screen.getByPlaceholderText("First Name") as HTMLInputElement;
          const lastNameInput = screen.getByPlaceholderText("Last Name") as HTMLInputElement;
          const companyInput = screen.getByPlaceholderText("Company") as HTMLInputElement;
          
          expect(firstNameInput.value).toBe("");
          expect(lastNameInput.value).toBe("");
          expect(companyInput.value).toBe("");
        },
        { timeout: 3000 }
      );
      
      // Verify again after waiting
      const firstNameInput = screen.getByPlaceholderText("First Name") as HTMLInputElement;
      const lastNameInput = screen.getByPlaceholderText("Last Name") as HTMLInputElement;
      const companyInput = screen.getByPlaceholderText("Company") as HTMLInputElement;

      expect(firstNameInput.value).toBe("");
      expect(lastNameInput.value).toBe("");
      expect(companyInput.value).toBe("");
    });
  });

  describe("User Interactions", () => {
    it("updates firstName on input change", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        firstName: "John",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<BasicInfoCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for input to be rendered
      const firstNameInput = await waitFor(() => {
        const input = screen.getByPlaceholderText("First Name") as HTMLInputElement;
        expect(input).toBeInTheDocument();
        return input;
      });
      
      fireEvent.change(firstNameInput, { target: { value: "Jane" } });
      
      expect(firstNameInput.value).toBe("Jane");
    });

    it("updates lastName on input change", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        lastName: "Doe",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<BasicInfoCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for input to be rendered (using placeholder since labels aren't associated)
      const lastNameInput = await waitFor(() => {
        const input = screen.getByPlaceholderText("Last Name") as HTMLInputElement;
        expect(input).toBeInTheDocument();
        return input;
      });
      
      fireEvent.change(lastNameInput, { target: { value: "Smith" } });
      
      expect(lastNameInput.value).toBe("Smith");
    });

    it("updates company on input change", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        company: "Old Company",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<BasicInfoCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for input to be rendered (using placeholder since labels aren't associated)
      const companyInput = await waitFor(() => {
        const input = screen.getByPlaceholderText("Company") as HTMLInputElement;
        expect(input).toBeInTheDocument();
        return input;
      });
      
      fireEvent.change(companyInput, { target: { value: "New Company" } });
      
      expect(companyInput.value).toBe("New Company");
    });

    it("calls save when Save button is clicked", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        firstName: "John",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<BasicInfoCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for input to be rendered
      const firstNameInput = await waitFor(() => {
        const input = screen.getByPlaceholderText("First Name");
        expect(input).toBeInTheDocument();
        return input;
      });
      
      fireEvent.change(firstNameInput, { target: { value: "Jane" } });
      
      // Wait for Save button to be enabled
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

    it("disables Save button when there are no changes", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        firstName: "John",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<BasicInfoCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for Save button to be rendered
      await waitFor(() => {
        const saveButton = screen.getByRole("button", { name: /save/i });
        expect(saveButton).toBeInTheDocument();
        expect(saveButton).toBeDisabled();
      });
    });
  });

  describe("Save Functionality", () => {
    it("calls update mutation with correct data on save", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        firstName: "John",
        lastName: "Doe",
        company: "Company",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<BasicInfoCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for input to be rendered and initialized with contact data
      const firstNameInput = await waitFor(() => {
        const input = screen.getByPlaceholderText("First Name") as HTMLInputElement;
        expect(input).toBeInTheDocument();
        expect(input.value).toBe("John");
        return input;
      });

      fireEvent.change(firstNameInput, { target: { value: "Jane" } });

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
              firstName: "Jane",
              lastName: "Doe",
              company: "Company",
            },
          },
          expect.any(Object)
        );
      });
    });

    it("saves null for empty fields", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        firstName: "John",
        lastName: "Doe",
        company: "Company",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<BasicInfoCard contactId={mockContactId} userId={mockUserId} />);
      
      // Wait for input to be rendered and initialized with contact data
      const firstNameInput = await waitFor(() => {
        const input = screen.getByPlaceholderText("First Name") as HTMLInputElement;
        expect(input).toBeInTheDocument();
        expect(input.value).toBe("John");
        return input;
      });

      fireEvent.change(firstNameInput, { target: { value: "" } });

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
              firstName: null,
            }),
          },
          expect.any(Object)
        );
      });
    });
  });

  describe("Save Status", () => {
    it("shows saving text during save", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        firstName: "John",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<BasicInfoCard contactId={mockContactId} userId={mockUserId} />);
      
      // Make a change and click Save
      const firstNameInput = await waitFor(() => screen.getByPlaceholderText("First Name"));
      fireEvent.change(firstNameInput, { target: { value: "Jane" } });
      
      const saveButton = await waitFor(() => {
        const button = screen.getByRole("button", { name: /save/i });
        expect(button).not.toBeDisabled();
        return button;
      });
      
      fireEvent.click(saveButton);
      
      // Should show "Saving..." text
      await waitFor(() => {
        expect(screen.getByText("Saving...")).toBeInTheDocument();
      });
    });

    it("only saves when there are unsaved changes", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        firstName: "John",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact));

      render(<BasicInfoCard contactId={mockContactId} userId={mockUserId} />);
      
      await waitFor(() => {
        const firstNameInput = screen.getByPlaceholderText("First Name");
        expect(firstNameInput).toBeInTheDocument();
      });
      
      // Don't make any changes - just render the component
      // The save function should not be called if there are no changes
      // Verify that mutate is not called (because hasChanges would be false)
      expect(mockMutate).not.toHaveBeenCalled();
      
      // Save button should be disabled
      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe("State Reset", () => {
    it("resets state when contactId changes", async () => {
      const mockContact1 = createMockContact({
        contactId: "contact-1",
        firstName: "John",
        lastName: "Doe",
      });

      const mockContact2 = createMockContact({
        contactId: "contact-2",
        firstName: "Jane",
        lastName: "Smith",
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact1));

      const { rerender } = render(<BasicInfoCard contactId="contact-1" userId={mockUserId} />);
      
      // Wait for input to be rendered and initialized (using placeholder since labels aren't associated)
      const firstNameInput = await waitFor(() => {
        const input = screen.getByPlaceholderText("First Name") as HTMLInputElement;
        expect(input).toBeInTheDocument();
        expect(input.value).toBe("John");
        return input;
      });

      mockUseContact.mockReturnValue(createMockUseQueryResult<Contact | null>(mockContact2));

      rerender(<BasicInfoCard contactId="contact-2" userId={mockUserId} />);
      
      await waitFor(() => {
        expect(firstNameInput.value).toBe("Jane");
      });
    });
  });
});

