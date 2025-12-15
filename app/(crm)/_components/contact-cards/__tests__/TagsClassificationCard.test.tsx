import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TagsClassificationCard from "../TagsClassificationCard";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact } from "@/hooks/useContactMutations";
import { useSavingState } from "@/contexts/SavingStateContext";
import { createMockContact, createMockUseQueryResult, createMockUseMutationResult } from "@/components/__tests__/test-utils";
import type { Contact } from "@/types/firestore";
import type { SavingStateContextType } from "@/contexts/SavingStateContext";

jest.mock("@/hooks/useContact");
jest.mock("@/hooks/useContactMutations");
jest.mock("@/contexts/SavingStateContext");
jest.mock("../../SegmentSelect", () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) => (
    <div data-testid="segment-select">
      <input
        data-testid="segment-input"
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  ),
}));

const mockUseContact = useContact as jest.MockedFunction<typeof useContact>;
const mockUseUpdateContact = useUpdateContact as jest.MockedFunction<typeof useUpdateContact>;
const mockUseSavingState = useSavingState as jest.MockedFunction<typeof useSavingState>;

describe("TagsClassificationCard", () => {
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

      render(<TagsClassificationCard contactId={mockContactId} userId={mockUserId} />);
      const { container } = render(<TagsClassificationCard contactId={mockContactId} userId={mockUserId} />);
      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Initialization", () => {
    it("initializes tags, segment, leadSource from contact", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        tags: ["Tag1", "Tag2"],
        segment: "Enterprise",
        leadSource: "Referral",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<TagsClassificationCard contactId={mockContactId} userId={mockUserId} />);
      
      const tagsInput = screen.getByPlaceholderText("tag1, tag2, tag3") as HTMLInputElement;
      const segmentInput = screen.getByTestId("segment-input") as HTMLInputElement;
      const leadSourceInput = screen.getByPlaceholderText("Enter lead source...") as HTMLInputElement;

      expect(tagsInput.value).toBe("Tag1, Tag2");
      expect(segmentInput.value).toBe("Enterprise");
      expect(leadSourceInput.value).toBe("Referral");
    });
  });

  describe("Tags Input", () => {
    it("allows free typing in tags input", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        tags: ["Tag1"],
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<TagsClassificationCard contactId={mockContactId} userId={mockUserId} />);
      
      const tagsInput = screen.getByPlaceholderText("tag1, tag2, tag3") as HTMLInputElement;
      fireEvent.change(tagsInput, { target: { value: "Tag1, Tag2, New Tag" } });
      
      expect(tagsInput.value).toBe("Tag1, Tag2, New Tag");
    });

    it("parses tags on blur (comma-separated)", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        tags: ["Tag1"],
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<TagsClassificationCard contactId={mockContactId} userId={mockUserId} />);
      
      const tagsInput = screen.getByPlaceholderText("tag1, tag2, tag3") as HTMLInputElement;
      fireEvent.change(tagsInput, { target: { value: "Tag1, Tag2, Tag3" } });
      fireEvent.blur(tagsInput);

      // After blur, tags should be normalized
      waitFor(() => {
        expect(tagsInput.value).toBe("Tag1, Tag2, Tag3");
      });
    });

    it("handles tags with spaces", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        tags: [],
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<TagsClassificationCard contactId={mockContactId} userId={mockUserId} />);
      
      const tagsInput = screen.getByPlaceholderText("tag1, tag2, tag3") as HTMLInputElement;
      fireEvent.change(tagsInput, { target: { value: "Project Manager, Marketing Lead,Referral, VIP" } });
      
      expect(tagsInput.value).toBe("Project Manager, Marketing Lead,Referral, VIP");
    });
  });

  describe("Segment and Lead Source", () => {
    it("updates segment on change", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        segment: "Enterprise",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<TagsClassificationCard contactId={mockContactId} userId={mockUserId} />);
      
      const segmentInput = screen.getByTestId("segment-input") as HTMLInputElement;
      fireEvent.change(segmentInput, { target: { value: "SMB" } });
      
      expect(segmentInput.value).toBe("SMB");
    });

    it("updates leadSource on change", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        leadSource: "Referral",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<TagsClassificationCard contactId={mockContactId} userId={mockUserId} />);
      
      const leadSourceInput = screen.getByPlaceholderText("Enter lead source...") as HTMLInputElement;
      fireEvent.change(leadSourceInput, { target: { value: "Website" } });
      
      expect(leadSourceInput.value).toBe("Website");
    });
  });

  describe("Save Functionality", () => {
    it("calls debounced save on blur", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        tags: ["Tag1"],
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<TagsClassificationCard contactId={mockContactId} userId={mockUserId} />);
      
      await waitFor(() => {
        const tagsInput = screen.getByPlaceholderText("tag1, tag2, tag3");
        expect(tagsInput).toBeInTheDocument();
      });
      
      const tagsInput = screen.getByPlaceholderText("tag1, tag2, tag3");
      fireEvent.change(tagsInput, { target: { value: "Tag1, Tag2" } });
      
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

    it("calls update mutation with parsed tags on save", async () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        tags: ["Tag1"],
        segment: "Enterprise",
        leadSource: "Referral",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<TagsClassificationCard contactId={mockContactId} userId={mockUserId} />);
      
      await waitFor(() => {
        const tagsInput = screen.getByPlaceholderText("tag1, tag2, tag3");
        expect(tagsInput).toBeInTheDocument();
      });

      const tagsInput = screen.getByPlaceholderText("tag1, tag2, tag3");
      fireEvent.change(tagsInput, { target: { value: "Tag1, Tag2, Tag3" } });

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
              tags: expect.arrayContaining(["Tag1", "Tag2", "Tag3"]),
            }),
          },
          expect.any(Object)
        );
      });
    });

    it("only saves when there are unsaved changes", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        tags: ["Tag1"],
        segment: "Enterprise",
        leadSource: "Referral",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<TagsClassificationCard contactId={mockContactId} userId={mockUserId} />);
      
      // Don't make any changes - Save button should be disabled
      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).toBeDisabled();

      // Should not call mutate if there are no changes
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  describe("State Reset", () => {
    it("resets state when contactId changes", () => {
      const mockContact1 = createMockContact({
        contactId: "contact-1",
        tags: ["Tag1"],
        segment: "Enterprise",
      });

      const mockContact2 = createMockContact({
        contactId: "contact-2",
        tags: ["Tag2"],
        segment: "SMB",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact1, false, null)
      );

      const { rerender } = render(<TagsClassificationCard contactId="contact-1" userId={mockUserId} />);
      
      const tagsInput = screen.getByPlaceholderText("tag1, tag2, tag3") as HTMLInputElement;
      expect(tagsInput.value).toBe("Tag1");

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact2, false, null)
      );

      rerender(<TagsClassificationCard contactId="contact-2" userId={mockUserId} />);
      
      expect(tagsInput.value).toBe("Tag2");
    });
  });
});

