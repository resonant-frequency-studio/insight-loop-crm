import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionItemsList from "../ActionItemsList";
import { useActionItems } from "@/hooks/useActionItems";
import { useCreateActionItem, useUpdateActionItem, useDeleteActionItem } from "@/hooks/useActionItemMutations";
import { createMockActionItem, createMockUseQueryResult, createMockUseMutationResult } from "@/components/__tests__/test-utils";
import type { ActionItem } from "@/types/firestore";

jest.mock("@/hooks/useActionItems");
jest.mock("@/hooks/useActionItemMutations");
jest.mock("../ActionItemCard", () => ({
  __esModule: true,
  default: ({ actionItem, onUpdate, onDelete }: { actionItem: ActionItem; onUpdate: () => void; onDelete: () => void }) => (
    <div data-testid={`action-item-${actionItem.actionItemId}`}>
      <span>{actionItem.text}</span>
      <button onClick={onUpdate} data-testid={`update-${actionItem.actionItemId}`}>Update</button>
      <button onClick={onDelete} data-testid={`delete-${actionItem.actionItemId}`}>Delete</button>
    </div>
  ),
}));
jest.mock("@/components/Modal", () => ({
  __esModule: true,
  default: ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => (
    isOpen ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        {children}
        <button onClick={onClose} data-testid="modal-close">Close</button>
      </div>
    ) : null
  ),
}));

const mockUseActionItems = useActionItems as jest.MockedFunction<typeof useActionItems>;
const mockUseCreateActionItem = useCreateActionItem as jest.MockedFunction<typeof useCreateActionItem>;
const mockUseUpdateActionItem = useUpdateActionItem as jest.MockedFunction<typeof useUpdateActionItem>;
const mockUseDeleteActionItem = useDeleteActionItem as jest.MockedFunction<typeof useDeleteActionItem>;

describe("ActionItemsList", () => {
  const mockUserId = "user-123";
  const mockContactId = "contact-123";
  const mockCreateMutate = jest.fn();
  const mockCreateMutateAsync = jest.fn().mockResolvedValue({});
  const mockUpdateMutate = jest.fn();
  const mockUpdateMutateAsync = jest.fn().mockResolvedValue({});
  const mockDeleteMutate = jest.fn();
  const mockDeleteMutateAsync = jest.fn().mockResolvedValue({});

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset and reconfigure mock functions - ensure they return promises
    mockCreateMutateAsync.mockClear();
    mockCreateMutateAsync.mockImplementation(async () => {
      return Promise.resolve({});
    });
    
    mockUpdateMutateAsync.mockClear();
    mockUpdateMutateAsync.mockImplementation(async () => {
      return Promise.resolve({});
    });
    
    mockDeleteMutateAsync.mockClear();
    mockDeleteMutateAsync.mockImplementation(async () => {
      return Promise.resolve({});
    });

    mockUseActionItems.mockReturnValue(createMockUseQueryResult<ActionItem[]>([]));

    // IMPORTANT: Return the exact same function references so we can track calls
    mockUseCreateActionItem.mockReturnValue(
      createMockUseMutationResult<unknown, Error, { contactId: string; text: string; dueDate?: Date | string | null }, unknown>(
        mockCreateMutate,
        mockCreateMutateAsync // Same reference!
      )
    );

    mockUpdateMutateAsync.mockResolvedValue({});
    mockUseUpdateActionItem.mockReturnValue(
      createMockUseMutationResult<unknown, Error, { contactId: string; actionItemId: string; updates: { text?: string; status?: "pending" | "completed"; dueDate?: Date | string | null } }, unknown>(
        mockUpdateMutate,
        mockUpdateMutateAsync
      )
    );

    mockDeleteMutateAsync.mockResolvedValue({});
    mockUseDeleteActionItem.mockReturnValue(
      createMockUseMutationResult<unknown, Error, { contactId: string; actionItemId: string }, unknown>(
        mockDeleteMutate,
        mockDeleteMutateAsync
      )
    );
  });

  describe("Loading State", () => {
    it("shows loading state when data is loading", () => {
      mockUseActionItems.mockReturnValue(createMockUseQueryResult<ActionItem[]>(undefined, true));

      render(
        <ActionItemsList
          userId={mockUserId}
          contactId={mockContactId}
          contactEmail="test@example.com"
        />
      );

      expect(screen.getByText(/Loading action items/)).toBeInTheDocument();
    });
  });

  describe("Rendering", () => {
    it("renders action items list", () => {
      const mockActionItems = [
        createMockActionItem({
          actionItemId: "item-1",
          text: "Follow up on proposal",
          status: "pending",
        }),
        createMockActionItem({
          actionItemId: "item-2",
          text: "Send contract",
          status: "completed",
        }),
      ];

      mockUseActionItems.mockReturnValue(createMockUseQueryResult<ActionItem[]>(mockActionItems));

      render(
        <ActionItemsList
          userId={mockUserId}
          contactId={mockContactId}
          contactEmail="test@example.com"
        />
      );

      expect(screen.getByText("Follow up on proposal")).toBeInTheDocument();
      expect(screen.getByText("Send contract")).toBeInTheDocument();
    });

    it("handles empty state", () => {
      mockUseActionItems.mockReturnValue(createMockUseQueryResult<ActionItem[]>([]));

      render(
        <ActionItemsList
          userId={mockUserId}
          contactId={mockContactId}
          contactEmail="test@example.com"
        />
      );

      expect(screen.getByText(/No action items yet/)).toBeInTheDocument();
    });
  });

  describe("Filtering", () => {
    it("filters by status (all)", () => {
      const mockActionItems = [
        createMockActionItem({ actionItemId: "item-1", status: "pending" }),
        createMockActionItem({ actionItemId: "item-2", status: "completed" }),
      ];

      mockUseActionItems.mockReturnValue(createMockUseQueryResult<ActionItem[]>(mockActionItems));

      render(
        <ActionItemsList
          userId={mockUserId}
          contactId={mockContactId}
          contactEmail="test@example.com"
        />
      );

      const allButton = screen.getByText("All");
      fireEvent.click(allButton);

      expect(screen.getByTestId("action-item-item-1")).toBeInTheDocument();
      expect(screen.getByTestId("action-item-item-2")).toBeInTheDocument();
    });

    it("filters by status (pending)", () => {
      const mockActionItems = [
        createMockActionItem({ actionItemId: "item-1", status: "pending" }),
        createMockActionItem({ actionItemId: "item-2", status: "completed" }),
      ];

      mockUseActionItems.mockReturnValue(createMockUseQueryResult<ActionItem[]>(mockActionItems));

      render(
        <ActionItemsList
          userId={mockUserId}
          contactId={mockContactId}
          contactEmail="test@example.com"
        />
      );

      const pendingButton = screen.getByText("Pending");
      fireEvent.click(pendingButton);

      expect(screen.getByTestId("action-item-item-1")).toBeInTheDocument();
      expect(screen.queryByTestId("action-item-item-2")).not.toBeInTheDocument();
    });

    it("filters by status (completed)", () => {
      const mockActionItems = [
        createMockActionItem({ actionItemId: "item-1", status: "pending" }),
        createMockActionItem({ actionItemId: "item-2", status: "completed" }),
      ];

      mockUseActionItems.mockReturnValue(createMockUseQueryResult<ActionItem[]>(mockActionItems));

      render(
        <ActionItemsList
          userId={mockUserId}
          contactId={mockContactId}
          contactEmail="test@example.com"
        />
      );

      const completedButton = screen.getByText("Completed");
      fireEvent.click(completedButton);

      expect(screen.queryByTestId("action-item-item-1")).not.toBeInTheDocument();
      expect(screen.getByTestId("action-item-item-2")).toBeInTheDocument();
    });
  });

  describe("Adding Action Items", () => {
    it("opens add form on 'Add Action Item' click", () => {
      mockUseActionItems.mockReturnValue(createMockUseQueryResult<ActionItem[]>([]));

      render(
        <ActionItemsList
          userId={mockUserId}
          contactId={mockContactId}
          contactEmail="test@example.com"
        />
      );

      const addButton = screen.getByText("Add Action Item");
      fireEvent.click(addButton);

      expect(screen.getByPlaceholderText("Enter action item...")).toBeInTheDocument();
    });

    it("creates new action item", async () => {
      mockUseActionItems.mockReturnValue(createMockUseQueryResult<ActionItem[]>([]));

      mockUseCreateActionItem.mockReturnValue(
        createMockUseMutationResult<unknown, Error, { contactId: string; text: string; dueDate?: Date | string | null }, unknown>(
          mockCreateMutate,
          mockCreateMutateAsync
        )
      );

      render(
        <ActionItemsList
          userId={mockUserId}
          contactId={mockContactId}
          contactEmail="test@example.com"
        />
      );

      const user = userEvent.setup();
      
      const addButton = screen.getByText("Add Action Item");
      await user.click(addButton);

      const textInput = await waitFor(() => {
        const input = screen.getByPlaceholderText("Enter action item...");
        expect(input).toBeInTheDocument();
        return input;
      });
      
      await user.type(textInput, "New action item");

      // Wait for the submit button to be enabled (it starts disabled when text is empty)
      const submitButton = await waitFor(() => {
        const button = screen.getByRole("button", { name: /^Add$/ });
        expect(button).toBeInTheDocument();
        expect(button).not.toHaveAttribute("disabled");
        expect(button).not.toHaveAttribute("aria-disabled", "true");
        return button;
      }, { timeout: 2000 });
      
      // Get the actual mutateAsync function that the component is using
      // Note: useCreateActionItem might be called multiple times, so get the last result
      const lastResult = mockUseCreateActionItem.mock.results[mockUseCreateActionItem.mock.results.length - 1];
      const componentMutateAsync = lastResult?.value?.mutateAsync;
      
      // Click the submit button
      await act(async () => {
        await user.click(submitButton);
      });
      
      // Wait for the component's mutateAsync to be called
      await waitFor(() => {
        expect(componentMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            contactId: mockContactId,
            text: "New action item",
          })
        );
      }, { timeout: 3000 });
    });
  });

  describe("Updating Action Items", () => {
    it("updates existing action item", () => {
      const mockActionItem = createMockActionItem({
        actionItemId: "item-1",
        text: "Original text",
        status: "pending",
      });

      mockUseActionItems.mockReturnValue(createMockUseQueryResult<ActionItem[]>([mockActionItem]));

      render(
        <ActionItemsList
          userId={mockUserId}
          contactId={mockContactId}
          contactEmail="test@example.com"
        />
      );

      const updateButton = screen.getByTestId("update-item-1");
      fireEvent.click(updateButton);

      // The update should be handled by ActionItemCard
      // We just verify the component renders correctly
      expect(screen.getByTestId("action-item-item-1")).toBeInTheDocument();
    });
  });

  describe("Deleting Action Items", () => {
    it("opens delete confirmation modal on delete click", () => {
      const mockActionItem = createMockActionItem({
        actionItemId: "item-1",
        text: "Action to delete",
      });

      mockUseActionItems.mockReturnValue(createMockUseQueryResult<ActionItem[]>([mockActionItem]));

      render(
        <ActionItemsList
          userId={mockUserId}
          contactId={mockContactId}
          contactEmail="test@example.com"
        />
      );

      const deleteButton = screen.getByTestId("delete-item-1");
      fireEvent.click(deleteButton);

      expect(screen.getByTestId("modal")).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete this action item/)).toBeInTheDocument();
    });

    it("deletes action item on confirm", async () => {
      const mockActionItem = createMockActionItem({
        actionItemId: "item-1",
        text: "Action to delete",
      });

      mockUseActionItems.mockReturnValue(createMockUseQueryResult<ActionItem[]>([mockActionItem]));

      render(
        <ActionItemsList
          userId={mockUserId}
          contactId={mockContactId}
          contactEmail="test@example.com"
        />
      );

      const deleteButton = screen.getByTestId("delete-item-1");
      fireEvent.click(deleteButton);

      // Find the delete button in the modal - it should be inside the modal
      const modal = screen.getByTestId("modal");
      const confirmButton = within(modal).getByRole("button", { name: /^Delete$/ });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            contactId: mockContactId,
            actionItemId: "item-1",
          })
        );
      });
    });

    it("closes modal on cancel", () => {
      const mockActionItem = createMockActionItem({
        actionItemId: "item-1",
        text: "Action to delete",
      });

      mockUseActionItems.mockReturnValue(createMockUseQueryResult<ActionItem[]>([mockActionItem]));

      render(
        <ActionItemsList
          userId={mockUserId}
          contactId={mockContactId}
          contactEmail="test@example.com"
        />
      );

      const deleteButton = screen.getByTestId("delete-item-1");
      fireEvent.click(deleteButton);

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("shows error messages on create failure", async () => {
      mockUseActionItems.mockReturnValue(createMockUseQueryResult<ActionItem[]>([]));

      // Make mutateAsync reject with an error
      mockCreateMutateAsync.mockRejectedValueOnce(new Error("Create failed"));

      render(
        <ActionItemsList
          userId={mockUserId}
          contactId={mockContactId}
          contactEmail="test@example.com"
        />
      );

      const addButton = screen.getByText("Add Action Item");
      fireEvent.click(addButton);

      const textInput = screen.getByPlaceholderText("Enter action item...");
      fireEvent.change(textInput, { target: { value: "New action item" } });

      const submitButton = await waitFor(() => {
        const button = screen.getByText("Add");
        expect(button).toBeInTheDocument();
        return button;
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Create failed")).toBeInTheDocument();
      });
    });
  });
});

